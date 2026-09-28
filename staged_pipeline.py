import os
import re
import json
import time
from dotenv import load_dotenv

load_dotenv()


CONFIG = {
    "target_language_code": "hi",
    "output_dir": "pipeline_stages",
}


def _save(stage_name, content, is_json=False):
    os.makedirs(CONFIG["output_dir"], exist_ok=True)
    path = os.path.join(CONFIG["output_dir"], stage_name)
    with open(path, "w", encoding="utf-8") as f:
        if is_json:
            json.dump(content, f, indent=2, ensure_ascii=False)
        else:
            f.write(content)
    print(f"[SAVED] {path}")
    return path


_groq_client_instance = None


def _groq_client():
    global _groq_client_instance
    if _groq_client_instance is None:
        from groq import Groq
        api_key = os.environ.get("GROQ_API_KEY")
        _groq_client_instance = Groq(api_key=api_key)
    return _groq_client_instance


def _call_groq_completion(prompt, system_prompt=None, temp=0.2):
    """
    Call Groq API with robust multi-model fallback and error handling.
    """
    client = _groq_client()
    models_to_try = [
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "allam-2-7b",
    ]
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    last_err = None
    for model_name in models_to_try:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=temp,
            )
            content = response.choices[0].message.content
            if content and content.strip():
                return content.strip()
        except Exception as e:
            print(f"[WARNING] Groq API attempt with model '{model_name}' failed: {e}")
            last_err = e
            continue

    raise RuntimeError(f"All Groq model attempts failed. Last error: {last_err}")


# ============================================================================
# STAGE 0: Text extraction from the uploaded document
# ============================================================================

def extract_text_from_document(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        text = _extract_pdf_text_pymupdf(file_path)
        # If PyMuPDF returned minimal text (<30 chars), fallback to page image OCR
        if text and len(text.strip()) >= 30:
            print("[INFO] PDF has text layer — used PyMuPDF")
        else:
            print("[INFO] Scanned or low-text PDF — running OCR on pages")
            try:
                image_paths = _pdf_pages_to_images(file_path)
                ocr_text = "\n\n".join(_extract_image_text(p) for p in image_paths)
                if ocr_text and len(ocr_text.strip()) > len(text.strip()):
                    text = ocr_text
            except Exception as e:
                print(f"[WARNING] PDF page OCR failed ({e}) — keeping PyMuPDF text")
    elif ext in (".jpg", ".jpeg", ".png"):
        text = _extract_image_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    if not text or not text.strip():
        text = "Medical document uploaded (no clear text extracted)."

    # Clean excessive newlines/whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    _save("0_raw_extracted_text.txt", text)
    return text


def _extract_pdf_text_pymupdf(pdf_path):
    import pymupdf
    text = ""
    with pymupdf.open(pdf_path) as doc:
        for page in doc:
            text += page.get_text()
    return text


def _pdf_pages_to_images(pdf_path, out_dir="_ocr_pages", dpi=200):
    import fitz
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    paths = []
    for i in range(len(doc)):
        pix = doc.load_page(i).get_pixmap(matrix=matrix)
        p = os.path.join(out_dir, f"page_{i + 1}.png")
        pix.save(p)
        paths.append(p)
    doc.close()
    return paths


def preprocess_for_ocr(image_path):
    import cv2
    import numpy as np
    from PIL import Image

    img = cv2.imread(image_path)
    if img is None:
        return image_path

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )

    coords = np.column_stack(np.where(thresh < 255))
    if coords.size > 100:
        angle = cv2.minAreaRect(coords)[-1]
        angle = -(90 + angle) if angle < -45 else -angle
        if abs(angle) > 0.5:
            h, w = thresh.shape
            matrix = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            thresh = cv2.warpAffine(thresh, matrix, (w, h),
                                     flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    out_path = os.path.splitext(image_path)[0] + "_preprocessed.png"
    Image.fromarray(thresh).save(out_path)
    return out_path


def _extract_image_text(image_path):
    try:
        clean_path = preprocess_for_ocr(image_path)
    except Exception:
        clean_path = image_path

    try:
        return _extract_image_text_tesseract(clean_path)
    except Exception as e:
        print(f"[WARNING] OCR unavailable ({type(e).__name__}: {e}) — proceeding with fallback text")
        return "Medical document image uploaded."


def _extract_image_text_tesseract(image_path):
    import pytesseract
    from PIL import Image
    return pytesseract.image_to_string(Image.open(image_path), lang="eng")


# ============================================================================
# STAGE 1: Medical information extraction — JSON response with schema fallback
# ============================================================================

def extract_medical_info_llm(raw_text):
    prompt = f"""You are an expert AI medical document parser.
Analyze the following text extracted from a medical document (prescription, lab report, blood test, discharge summary, radiology report, or clinical note).

Extract ALL medical details accurately into a single structured JSON object.
The JSON object MUST have these exact keys:
- "document_type": string, one of "prescription", "lab_report", "discharge_summary", or "medical_report"
- "summary": string, concise 1-3 sentence plain language summary of what this document is about.
- "medications": array of objects, each having:
    "name": medicine name
    "dosage": dosage amount/strength (e.g. "500 mg", "10 mL")
    "frequency": how often (e.g. "twice daily", "once daily")
    "duration": length of course (e.g. "5 days")
    "instruction": extra instructions (e.g. "take after meals")
- "lab_results": array of objects (for test results, blood work, lab metrics), each having:
    "test_name": test name (e.g. "HEAMOGLOBIN", "Fasting Blood Sugar")
    "result": observed value (e.g. "10.9", "120 mg/dL")
    "reference_range": normal range (e.g. "12.5 - 18.0")
    "status": interpretation (e.g. "Low", "Normal", "High", "Abnormal")
- "diagnoses": array of strings (diagnosed conditions or medical findings)
- "doctor_notes": array of strings (advice, precautions, follow-up recommendations)

Return ONLY valid JSON. No markdown syntax, no extra text outside JSON.

OCR text:
\"\"\"{raw_text}\"\"\"
"""
    try:
        raw_response = _call_groq_completion(prompt, temp=0.1)
        parsed = _parse_json_response(raw_response, stage_name="1_extracted_medical_info")
    except Exception as e:
        print(f"[WARNING] Stage 1 LLM extraction failed ({e}) — using regex fallback parser")
        parsed = {}

    if not isinstance(parsed, dict):
        if isinstance(parsed, list):
            parsed = {"medications": parsed}
        else:
            parsed = {}

    parsed.setdefault("document_type", detect_document_type(raw_text))
    parsed.setdefault("summary", f"Medical document of type {parsed['document_type'].replace('_', ' ')}.")
    parsed.setdefault("medications", [])
    parsed.setdefault("lab_results", [])
    parsed.setdefault("diagnoses", [])
    parsed.setdefault("doctor_notes", [])

    # Regex fallback if lab results are empty but test results exist in text
    if not parsed["lab_results"] and parsed["document_type"] == "lab_report":
        parsed["lab_results"] = _detect_lab_results_fallback(raw_text)

    _save("1_extracted_medical_info.json", parsed, is_json=True)
    return parsed


def _parse_json_response(raw_text, stage_name="llm_response"):
    if not raw_text or not raw_text.strip():
        _save(f"DEBUG_{stage_name}_raw.txt", "[EMPTY RESPONSE FROM LLM]")
        raise ValueError(f"LLM returned an empty response for {stage_name}.")

    cleaned = re.sub(r"```json|```", "", raw_text).strip()

    if not (cleaned.startswith("[") or cleaned.startswith("{")):
        match = re.search(r"(\[.*\]|\{.*\})", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        _save(f"DEBUG_{stage_name}_raw.txt", raw_text)
        raise ValueError(
            f"Could not parse JSON from LLM response for {stage_name}: {e}"
        ) from e


def _detect_lab_results_fallback(raw_text):
    """Regex extractor for common lab result lines: TEST_NAME RESULT REFERENCE_RANGE"""
    results = []
    lines = raw_text.splitlines()
    for line in lines:
        line_str = line.strip()
        if not line_str or len(line_str) < 5:
            continue
        # Pattern matching e.g. HEAMOGLOBIN 10.9 12.5 - 18.0
        m = re.search(r"([A-Za-z\s]{3,30})\s+([\d\.]+)\s+([\d\.\s\-]+)", line_str)
        if m:
            tname, val, ref = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
            if tname.upper() not in ("TEST", "RESULT", "DATE", "REPORTED", "RECEIVED"):
                results.append({
                    "test_name": tname,
                    "result": val,
                    "reference_range": ref,
                    "status": "Observed"
                })
    return results


# ============================================================================
# STAGE 2: Build a narrative from structured medical info
# ============================================================================

def build_narrative_template(info):
    if isinstance(info, list):
        medications = info
        info = {"medications": medications}

    sentences = []

    summary = info.get("summary")
    if summary and isinstance(summary, str) and summary.strip():
        sentences.append(f"Document Overview: {summary.strip()}")

    diagnoses = info.get("diagnoses", [])
    if diagnoses and isinstance(diagnoses, list):
        clean_diag = [str(d).strip() for d in diagnoses if d and str(d).strip()]
        if clean_diag:
            sentences.append(f"Diagnoses and Conditions: {', '.join(clean_diag)}.")

    lab_results = info.get("lab_results", [])
    if lab_results and isinstance(lab_results, list):
        lab_lines = []
        for lab in lab_results:
            if isinstance(lab, dict):
                tname = lab.get("test_name", "Test")
                res = lab.get("result", "")
                ref = lab.get("reference_range", "")
                stat = lab.get("status", "")
                line = f"{tname}: {res}"
                if ref:
                    line += f" (Reference Range: {ref})"
                if stat:
                    line += f" [{stat}]"
                lab_lines.append(line)
        if lab_lines:
            sentences.append("Lab & Diagnostic Results: " + "; ".join(lab_lines) + ".")

    medications = info.get("medications", [])
    if medications and isinstance(medications, list):
        med_lines = []
        for med in medications:
            if isinstance(med, dict):
                fields = [
                    med.get("name", ""),
                    med.get("dosage", ""),
                    med.get("frequency", ""),
                    med.get("duration", ""),
                    med.get("instruction", ""),
                ]
                fields = [str(f).strip() for f in fields if f and str(f).strip()]
                if fields:
                    med_lines.append(", ".join(fields))
        if med_lines:
            sentences.append("Prescribed Medications: " + ". ".join(med_lines) + ".")

    doctor_notes = info.get("doctor_notes", [])
    if doctor_notes and isinstance(doctor_notes, list):
        clean_notes = [str(n).strip() for n in doctor_notes if n and str(n).strip()]
        if clean_notes:
            sentences.append("Doctor's Advice & Instructions: " + " ".join(clean_notes))

    narrative = " ".join(sentences).strip()

    # Guaranteed non-empty fallback
    if not narrative or narrative == ".":
        narrative = "Medical document summary: Extracted information from uploaded medical document."

    _save("2_narrative.txt", narrative)
    return narrative


# ============================================================================
# STAGE 3: Simplify the narrative for a general patient
# ============================================================================

def simplify_narrative_llm(narrative, raw_text=""):
    if not narrative or narrative.strip() in (".", ""):
        narrative = f"Medical Document Content: {raw_text[:300]}"

    prompt = f"""Rewrite this medical instruction in simple, everyday language a patient with no medical background can easily follow. Keep every factual detail (amounts, lab values, days, timing) exactly correct — only simplify the wording and explain anything technical.

Output rules:
- Plain text only — no markdown, no bullet points, no bold (**), no headers.
- One single paragraph, no line breaks.
- Return ONLY the simplified explanation, nothing else.

Text:
\"\"\"{narrative}\"\"\"
"""
    try:
        simplified = _call_groq_completion(prompt, temp=0.3)
        simplified = _clean_llm_formatting(simplified)
    except Exception as e:
        print(f"[WARNING] Stage 3 simplification failed ({e}) — using clean narrative fallback")
        simplified = _clean_llm_formatting(narrative)

    if not simplified:
        simplified = _clean_llm_formatting(narrative)

    _save("3_simplified_explanation.txt", simplified)
    return simplified


def _clean_llm_formatting(text):
    if not text:
        return ""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"^[•\-\*]\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


# ============================================================================
# STAGE 4: Translation
# ============================================================================

MYMEMORY_LANG_MAP = {
    "hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN",
    "mr": "mr-IN", "gu": "gu-IN", "kn": "kn-IN", "pa": "pa-IN",
    "ur": "ur-PK", "en": "en-GB",
}

LANG_NAMES = {
    "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
    "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada", "pa": "Punjabi",
    "ur": "Urdu", "en": "English", "es": "Spanish", "fr": "French"
}


def _translate_with_groq(text, target_lang_code):
    try:
        lang_name = LANG_NAMES.get(target_lang_code, target_lang_code)
        prompt = f"Translate the following medical explanation accurately into {lang_name}. Return ONLY the translated text without markdown formatting, bullet points, or commentary:\n\n{text}"
        translated = _call_groq_completion(prompt, temp=0.3)
        return _clean_llm_formatting(translated)
    except Exception as e:
        print(f"[ERROR] Groq LLM translation fallback failed: {e}")
        return None


def translate_explanation(text, target_lang_code=None):
    if not text or not text.strip():
        _save("4_translated_explanation.txt", "")
        return ""

    if target_lang_code is None:
        target_lang_code = CONFIG["target_language_code"]

    clean_text = text.replace("\u202f", " ").replace("\xa0", " ").strip()

    # Short-circuit if target language is English
    if target_lang_code and target_lang_code.lower() in ["en", "en-us", "en-gb", "english"]:
        _save("4_translated_explanation.txt", clean_text)
        return clean_text

    translated = None

    # Tier 1: Try GoogleTranslator
    try:
        from deep_translator import GoogleTranslator
        translated = GoogleTranslator(source="en", target=target_lang_code).translate(clean_text)
    except Exception as e:
        print(f"[WARNING] Google Translate failed ({type(e).__name__}: {e}) — using fast Groq LLM translation")

    # Tier 2: Try Groq LLM Translation
    if not translated:
        translated = _translate_with_groq(clean_text, target_lang_code)

    # Tier 3: Try MyMemoryTranslator
    if not translated:
        try:
            from deep_translator import MyMemoryTranslator
            mm_target = MYMEMORY_LANG_MAP.get(target_lang_code, target_lang_code)
            translated = MyMemoryTranslator(source="en-GB", target=mm_target).translate(clean_text)
        except Exception as e2:
            print(f"[WARNING] MyMemory Translate failed ({type(e2).__name__}: {e2})")

    # Tier 4: Graceful fallback to original clean text
    if not translated or translated.startswith("[TRANSLATION FAILED"):
        print("[WARNING] All translation methods failed — defaulting to English simplified text")
        translated = clean_text

    _save("4_translated_explanation.txt", translated)
    return translated


# ============================================================================
# STAGE 5: Assemble final JSON output
# ============================================================================

def detect_document_type(text):
    lower = text.lower()
    if "discharge" in lower:
        return "discharge_summary"
    if any(k in lower for k in ["test result", "reference range", "lab report", "specimen", "heamoglobin", "hemoglobin"]):
        return "lab_report"
    return "prescription"


def assemble_final_json(raw_text, info, simplified, translated, language):
    if isinstance(info, list):
        medications = info
        doc_type = detect_document_type(raw_text)
        lab_results = []
        diagnoses = []
        doctor_notes = []
        summary = ""
    else:
        medications = info.get("medications", [])
        doc_type = info.get("document_type", detect_document_type(raw_text))
        lab_results = info.get("lab_results", [])
        diagnoses = info.get("diagnoses", [])
        doctor_notes = info.get("doctor_notes", [])
        summary = info.get("summary", "")

    result = {
        "document_type": doc_type,
        "raw_text": raw_text,
        "summary": summary,
        "medications": medications,
        "lab_results": lab_results,
        "diagnoses": diagnoses,
        "doctor_notes": doctor_notes,
        "simplified_explanation": simplified,
        "translated_explanation": translated,
        "language": language,
    }
    _save("5_final_output.json", result, is_json=True)
    return result


# ============================================================================
# FULL STAGED PIPELINE
# ============================================================================

def run_pipeline(file_path, target_lang=None):
    """
    Run the full extraction/simplification/translation pipeline.
    """
    if target_lang is None:
        target_lang = CONFIG["target_language_code"]

    t0 = time.time()
    raw_text = extract_text_from_document(file_path)          # Stage 0
    print(f"[TIMING] Stage 0 (extraction): {time.time() - t0:.1f}s")

    t1 = time.time()
    info = extract_medical_info_llm(raw_text)                  # Stage 1
    medications = info.get("medications", []) if isinstance(info, dict) else info
    print(f"[TIMING] Stage 1 (LLM extraction): {time.time() - t1:.1f}s")

    t2 = time.time()
    narrative = build_narrative_template(info)                  # Stage 2
    print(f"[TIMING] Stage 2 (narrative template): {time.time() - t2:.1f}s")

    t3 = time.time()
    simplified = simplify_narrative_llm(narrative, raw_text)    # Stage 3
    print(f"[TIMING] Stage 3 (LLM simplification): {time.time() - t3:.1f}s")

    t4 = time.time()
    translated = translate_explanation(simplified, target_lang_code=target_lang)  # Stage 4
    print(f"[TIMING] Stage 4 (translation): {time.time() - t4:.1f}s")

    final = assemble_final_json(raw_text, info, simplified, translated, target_lang)  # Stage 5
    print(f"[TIMING] TOTAL: {time.time() - t0:.1f}s")
    return final


if __name__ == "__main__":
    INPUT_FILE = "pipeline_stages/0_raw_extracted_text.txt"
    if os.path.exists(INPUT_FILE):
        with open(INPUT_FILE, encoding="utf-8") as f:
            t = f.read()
        info = extract_medical_info_llm(t)
        narr = build_narrative_template(info)
        simp = simplify_narrative_llm(narr, t)
        trans = translate_explanation(simp, "hi")
        res = assemble_final_json(t, info, simp, trans, "hi")
        try:
            print(json.dumps(res, indent=2, ensure_ascii=False))
        except Exception:
            print(json.dumps(res, indent=2, ensure_ascii=True))