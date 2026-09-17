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
        _groq_client_instance = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    return _groq_client_instance



# STAGE 0: Text extraction from the uploaded document

def extract_text_from_document(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        text = _extract_pdf_text_pymupdf(file_path)
        if text.strip():
            print("[INFO] PDF has a text layer — used PyMuPDF")
        else:
            print("[INFO] Scanned PDF — running OCR on each page")
            image_paths = _pdf_pages_to_images(file_path)
            text = "\n\n".join(_extract_image_text(p) for p in image_paths)
    elif ext in (".jpg", ".jpeg", ".png"):
        text = _extract_image_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

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
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Fast GaussianBlur replaces slow fastNlMeansDenoising (executes in ~2ms vs 500-5000ms)
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
        print(f"[WARNING] OCR unavailable ({type(e).__name__}: {e}) — proceeding with document processing")
        return "Medical document image uploaded."


def _extract_image_text_tesseract(image_path):
    import pytesseract
    from PIL import Image
    return pytesseract.image_to_string(Image.open(image_path), lang="eng")



# STAGE 1: Medical information extraction — LLM outputs JSON directly

def extract_medical_info_llm(raw_text):
    client = _groq_client()

    prompt = f"""This text was extracted via OCR from a medical document
and may contain OCR errors. Extract every medicine into a JSON array, where
each object has exactly these fields:

- "name": medicine name
- "dosage": overall strength/amount
- "frequency": how often in plain English
- "duration": total course length if stated, else ""
- "instruction": extra administration details

If no medicines/prescriptions are found in the text, return an empty JSON array: [].
Return ONLY the JSON array, no explanation, no markdown formatting.

OCR text:
\"\"\"{raw_text}\"\"\"
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": prompt}],
        )

    raw = response.choices[0].message.content.strip()
    medications = _parse_json_response(raw, stage_name="1_extracted_medical_info")

    _save("1_extracted_medical_info.json", medications, is_json=True)
    return medications


def _parse_json_response(raw_text, stage_name="llm_response"):
    if not raw_text or not raw_text.strip():
        return []

    cleaned = re.sub(r"```json|```", "", raw_text).strip()

    if not (cleaned.startswith("[") or cleaned.startswith("{")):
        match = re.search(r"(\[.*\]|\{.*\})", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1)

    try:
        res = json.loads(cleaned)
        return res if isinstance(res, list) else [res]
    except Exception as e:
        print(f"[WARNING] Could not parse JSON from LLM response ({stage_name}): {e}. Raw text: {raw_text[:100]}")
        return []



# STAGE 2: Build a narrative from the structured medical info

def build_narrative_template(medications):
    sentences = []
    for med in medications:
        fields = [
            med.get("name", ""),
            med.get("dosage", ""),
            med.get("frequency", ""),
            med.get("duration", ""),
            med.get("instruction", ""),
        ]
        fields = [f for f in fields if f and str(f).strip()]
        sentences.append(", ".join(fields))

    narrative = ". ".join(sentences) + "."

    _save("2_narrative.txt", narrative)
    return narrative



# STAGE 3: Simplify the narrative for a general patient

def simplify_narrative_llm(narrative):
    client = _groq_client()

    prompt = f"""Rewrite this medical instruction in simple, everyday
language a patient with no medical background can easily follow. Keep
every factual detail (amounts, days, timing) exactly correct — only
simplify the wording and explain anything technical.

Output rules:
- Plain text only — no markdown, no bullet points, no bold (**), no headers.
- One single paragraph, no line breaks.
- Return ONLY the simplified explanation, nothing else.

Text:
\"\"\"{narrative}\"\"\"
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": prompt}],
        )
    simplified = response.choices[0].message.content.strip()
    simplified = _clean_llm_formatting(simplified)

    _save("3_simplified_explanation.txt", simplified)
    return simplified


def _clean_llm_formatting(text):
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)   
    text = re.sub(r"^[•\-\*]\s*", "", text, flags=re.MULTILINE) 
    text = re.sub(r"\s*\n\s*", " ", text)         
    text = re.sub(r"\s{2,}", " ", text)            
    return text.strip()



# STAGE 4: Translation

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
        client = _groq_client()
        lang_name = LANG_NAMES.get(target_lang_code, target_lang_code)
        prompt = f"Translate the following medical explanation accurately into {lang_name}. Return ONLY the translated text without markdown formatting, bullet points, or commentary:\n\n{text}"
        try:
            res = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
        except Exception:
            res = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
        translated = res.choices[0].message.content.strip()
        return _clean_llm_formatting(translated)
    except Exception as e:
        print(f"[ERROR] Groq LLM translation fallback failed: {e}")
        return None


def translate_explanation(text, target_lang_code=None):
    if target_lang_code is None:
        target_lang_code = CONFIG["target_language_code"]

    clean_text = text.replace("\u202f", " ").replace("\xa0", " ").strip()

    # Short-circuit if target language is English
    if target_lang_code and target_lang_code.lower() in ["en", "en-us", "en-gb"]:
        _save("4_translated_explanation.txt", clean_text)
        return clean_text

    from deep_translator import GoogleTranslator, MyMemoryTranslator

    translated = None

    # Tier 1: Try GoogleTranslator
    try:
        translated = GoogleTranslator(source="en", target=target_lang_code).translate(clean_text)
    except Exception as e:
        print(f"[WARNING] Google Translate failed ({type(e).__name__}: {e}) — using fast Groq LLM translation")
        # Tier 2: Try Groq LLM Translation (fast, high quality)
        translated = _translate_with_groq(clean_text, target_lang_code)
        if not translated:
            # Tier 3: Try MyMemoryTranslator
            try:
                mm_target = MYMEMORY_LANG_MAP.get(target_lang_code, target_lang_code)
                translated = MyMemoryTranslator(source="en-GB", target=mm_target).translate(clean_text)
            except Exception as e2:
                print(f"[WARNING] MyMemory Translate failed ({type(e2).__name__}: {e2})")

    # Tier 4: Graceful fallback to original clean text if all translation channels fail
    if not translated or translated.startswith("[TRANSLATION FAILED"):
        print("[WARNING] All translation methods failed — defaulting to English simplified text")
        translated = clean_text

    _save("4_translated_explanation.txt", translated)
    return translated



# STAGE 5: Assemble the final detailed JSON

def detect_document_type(text):
    lower = text.lower()
    if "discharge" in lower:
        return "discharge_summary"
    if any(k in lower for k in ["test result", "reference range", "lab report", "specimen"]):
        return "medical_report"
    return "prescription"


def assemble_final_json(raw_text, medications, simplified, translated, language):
    result = {
        "document_type": detect_document_type(raw_text),
        "raw_text": raw_text,
        "medications": medications,
        "simplified_explanation": simplified,
        "translated_explanation": translated,
        "language": language,
    }
    _save("5_final_output.json", result, is_json=True)
    return result



# FULL STAGED PIPELINE

def run_pipeline(file_path, target_lang=None):
    """
    Run the full extraction/simplification/translation pipeline.

    target_lang: language code to translate into (e.g. "hi", "bn"). Falls
    back to CONFIG["target_language_code"] if not given.
    """
    if target_lang is None:
        target_lang = CONFIG["target_language_code"]

    t0 = time.time()
    raw_text = extract_text_from_document(file_path)          # Stage 0
    print(f"[TIMING] Stage 0 (extraction): {time.time() - t0:.1f}s")

    t1 = time.time()
    medications = extract_medical_info_llm(raw_text)          # Stage 1
    print(f"[TIMING] Stage 1 (LLM extraction): {time.time() - t1:.1f}s")

    t2 = time.time()
    narrative = build_narrative_template(medications)          # Stage 2 — free, no LLM
    print(f"[TIMING] Stage 2 (narrative template): {time.time() - t2:.1f}s")

    t3 = time.time()
    simplified = simplify_narrative_llm(narrative)              # Stage 3
    print(f"[TIMING] Stage 3 (LLM simplification): {time.time() - t3:.1f}s")

    t4 = time.time()
    translated = translate_explanation(simplified, target_lang_code=target_lang)  # Stage 4
    print(f"[TIMING] Stage 4 (translation): {time.time() - t4:.1f}s")

    final = assemble_final_json(raw_text, medications, simplified, translated, target_lang)  # Stage 5
    print(f"[TIMING] TOTAL: {time.time() - t0:.1f}s")
    return final


if __name__ == "__main__":
    INPUT_FILE = "Discharge Summary For Mental Health.pdf"

    result = run_pipeline(INPUT_FILE)
    print("\n" + "=" * 60)
    print("FINAL OUTPUT")
    print("=" * 60)
    print(json.dumps(result, indent=2, ensure_ascii=False))