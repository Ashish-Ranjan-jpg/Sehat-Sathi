import os
import shutil
import uuid
import traceback

from typing import Optional, Literal

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from staged_pipeline import run_pipeline, CONFIG
import document_store
import auth_store
import auth
import storage

app = FastAPI(
    title="Healthcare Communication Assistant — Processing API",
    description="Extracts, structures, simplifies, and translates medical documents.",
    version="1.1.0",
)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://sehat-sathi-43z9.onrender.com",
    "https://sehat-sathi-nn0cq22q6-ashish-f87c.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
UPLOAD_DIR = "uploaded_documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)



class PatientCreate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    preferred_language: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact: Optional[str] = None
    medical_conditions: Optional[str] = None


class PatientUpdate(BaseModel):
    """All fields optional — only the ones actually sent get updated."""
    name: Optional[str] = None
    phone_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    preferred_language: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact: Optional[str] = None
    medical_conditions: Optional[str] = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: Literal["patient", "healthcare_worker", "admin"]
    name: Optional[str] = None
    # Only meaningful when role == "patient" — used to create their profile
    phone_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    preferred_language: Optional[str] = None
    # Only meaningful when role == "healthcare_worker" or "admin"
    invite_code: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None


@app.get("/health")
def health_check():
    """Simple check that the service is running and reachable."""
    return {"status": "ok"}


@app.post("/auth/register", status_code=201)
def register(payload: RegisterRequest):
    """
    Create an account. role='patient' also creates a linked patient profile
    (using name/phone_number/age/gender/preferred_language if given).
    role='healthcare_worker' just creates the account itself.

    Returns an access token immediately, so the client doesn't need a
    separate login call right after registering.
    """
    if "@" not in payload.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    patient_id = None
    worker_id = None
    is_verified = False

    if payload.role == "patient":
        profile = document_store.register_patient(
            name=payload.name,
            phone_number=payload.phone_number,
            age=payload.age,
            gender=payload.gender,
            preferred_language=payload.preferred_language,
        )
        patient_id = profile["id"]

    elif payload.role == "admin":
        if not auth.is_valid_admin_invite_code(payload.invite_code):
            raise HTTPException(status_code=403, detail="Invalid or missing admin invite code")
        is_verified = True
        profile = {"role": "admin", "name": payload.name}

    else:  # healthcare_worker
        # A role claim alone proves nothing — anyone could set
        # role="healthcare_worker" and gain access to every patient's data.
        # A valid invite code is this project's stand-in for a real
        # credential/license check; only accounts created with one are
        # marked verified, and only verified accounts get healthcare_worker
        # privileges (see auth.require_role / require_patient_path_access).
        if not auth.is_valid_healthcare_worker_invite_code(payload.invite_code):
            raise HTTPException(status_code=403, detail="Invalid or missing healthcare worker invite code")

        profile = document_store.register_healthcare_worker(
            name=payload.name,
            employee_id=payload.employee_id,
            department=payload.department,
            phone_number=payload.phone_number,
        )
        worker_id = profile["id"]
        is_verified = True

    password_hash, password_salt = auth.hash_password(payload.password)
    try:
        user = auth_store.create_user(
            email=payload.email,
            password_hash=password_hash,
            password_salt=password_salt,
            role=payload.role,
            name=payload.name,
            patient_id=patient_id,
            worker_id=worker_id,
            is_verified=is_verified,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token = auth.create_access_token(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": auth.public_user(user),
        "profile": profile,
    }


@app.get("/auth/me")
def get_me(current_user: dict = Depends(auth.get_current_user)):
    """Return the currently authenticated user along with their linked profile."""
    profile = None
    if current_user.get("role") == "patient" and current_user.get("patient_id"):
        profile = document_store.get_patient(current_user["patient_id"])
    elif current_user.get("role") == "healthcare_worker" and current_user.get("worker_id"):
        profile = document_store.get_healthcare_worker(current_user["worker_id"])

    return {
        "user": auth.public_user(current_user),
        "profile": profile,
    }


@app.post("/auth/login")
async def login(request: Request):
    """
    Supports both JSON payloads ({"email": "...", "password": "..."})
    and OAuth2 form data (username=...&password=...) so both the React
    frontend and the interactive Swagger /docs 'Authorize' button work smoothly.
    """
    content_type = request.headers.get("content-type", "").lower()
    username = None
    password = None

    if "application/json" in content_type:
        body = await request.json()
        username = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        form = await request.form()
        username = form.get("username") or form.get("email")
        password = form.get("password")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Missing email/username or password")

    user = auth_store.get_user_by_email(username)
    if not user or not auth.verify_password(password, user["password_hash"], user["password_salt"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    profile = None
    if user.get("role") == "patient" and user.get("patient_id"):
        profile = document_store.get_patient(user["patient_id"])
    elif user.get("role") == "healthcare_worker" and user.get("worker_id"):
        profile = document_store.get_healthcare_worker(user["worker_id"])

    token = auth.create_access_token(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": auth.public_user(user),
        "profile": profile,
    }



@app.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    patient_id: Optional[str] = Form(
        None,
        description="Existing patient ID to attach this document to. "
                    "healthcare_worker only — ignored for patient accounts, "
                    "who always upload to their own patient_id. Omit to "
                    "have a new patient created automatically (healthcare_worker only)."
    ),
    target_language: Optional[str] = Form(
        None,
        description="Language code to translate the explanation into "
                    "(e.g. 'hi', 'bn', 'ta'). Falls back to the pipeline "
                    "default if omitted."
    ),
    current_user: dict = Depends(auth.get_current_user),
):
    """
    Upload a medical document, run it through the full pipeline (extract ->
    structure -> simplify -> translate), and persist the original file, the
    document record, and the pipeline's output (as a medical_extractions
    row) under a new document ID. The uploaded file is kept on disk instead
    of being deleted after processing.
    """

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    if current_user["role"] == "patient":
        # A patient account can only ever attach documents to themselves —
        # any patient_id in the form is ignored, not just unauthorized.
        resolved_patient_id = current_user["patient_id"]
    else:
        # healthcare_worker: find-or-create the patient this document
        # belongs to. If patient_id wasn't given, a new one is generated
        # and returned to the client.
        resolved_patient_id = document_store.get_or_create_patient(patient_id)

    # Language resolution order: explicit request > patient's saved
    # preference > pipeline default (handled inside run_pipeline).
    resolved_language = target_language
    if resolved_language is None:
        patient_record = document_store.get_patient(resolved_patient_id)
        if patient_record:
            resolved_language = patient_record.get("preferred_language")

    # Save the upload with a unique name so concurrent requests never collide
    document_id = uuid.uuid4().hex[:12]
    saved_filename = f"{document_id}{ext}"
    file_bytes = await file.read()

    stored_path = storage.save_file(
        filename=saved_filename,
        content=file_bytes,
        content_type=file.content_type or "application/octet-stream",
    )
    local_pipeline_path = os.path.join(UPLOAD_DIR, saved_filename)

    try:
        result = run_pipeline(local_pipeline_path, target_lang=resolved_language)

        # Only persist records once processing has actually succeeded
        document_store.create_document(
            document_id=document_id,
            patient_id=resolved_patient_id,
            original_filename=file.filename,
            stored_filename=saved_filename,
            stored_path=stored_path,
            content_type=file.content_type or "application/octet-stream",
        )
        document_store.create_extraction(
            document_id=document_id,
            patient_id=resolved_patient_id,
            document_type=result["document_type"],
            raw_text=result["raw_text"],
            processed_data=result["medications"],
            simplified_text=result["simplified_explanation"],
            translated_text=result["translated_explanation"],
            language=result["language"],
        )

        result["document_id"] = document_id
        result["patient_id"] = resolved_patient_id
        return JSONResponse(content=result)

    except ValueError as e:
        _cleanup_failed_upload(stored_path)
        raise HTTPException(status_code=502, detail=str(e))

    except Exception as e:
        print(traceback.format_exc())
        _cleanup_failed_upload(stored_path)
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}"
        )


def _cleanup_failed_upload(saved_path):
    """Remove a saved file when processing failed."""
    if saved_path:
        storage.delete_file(saved_path)


@app.get("/documents", dependencies=[Depends(auth.require_role("healthcare_worker"))])
def list_documents():
    """Retrieve a list of all uploaded documents (summary view, no result body)."""
    return {"documents": document_store.list_documents()}


@app.get("/documents/{document_id}")
def get_document(document_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Retrieve one specific document (metadata + full pipeline result) by its ID."""
    record = document_store.get_document(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")
    auth.authorize_document_access(record, current_user)
    return record


@app.get("/documents/{document_id}/file")
def download_document_file(document_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Download the original uploaded file for a specific document."""
    record = document_store.get_document(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")
    auth.authorize_document_access(record, current_user)

    stored_path = record["stored_path"]
    try:
        content = storage.read_file_bytes(stored_path)
        filename = record.get("original_filename") or "document"
        content_type = record.get("content_type") or "application/octet-stream"
        return Response(
            content=content,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Stored file is missing.")


@app.delete("/documents/{document_id}")
def delete_document(document_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Delete a specific document (record + underlying file) by its ID."""
    record = document_store.get_document(document_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")
    auth.authorize_document_access(record, current_user)

    document_store.delete_document(document_id)
    return {"status": "deleted", "document_id": document_id}


@app.post("/patients", dependencies=[Depends(auth.require_role("healthcare_worker"))])
def register_patient(patient: PatientCreate):
    """Register a new patient profile without a login account (a healthcare
    worker entering a patient's details on their behalf). A patient who
    wants their own login should use POST /auth/register with role='patient'
    instead — that creates both the account and this same kind of profile."""
    return document_store.register_patient(**patient.model_dump())


@app.get("/patients", dependencies=[Depends(auth.require_role("healthcare_worker"))])
def list_patients():
    """Retrieve every registered patient profile. Restricted to healthcare
    workers — this is a system-wide listing across all patients."""
    return {"patients": document_store.list_patients()}


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str, current_user: dict = Depends(auth.require_patient_path_access)):
    """Retrieve one patient's profile by ID."""
    record = document_store.get_patient(patient_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Patient not found: {patient_id}")
    return record


@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Delete a patient profile — restricted to the patient themselves deleting
    their own account. Healthcare workers cannot delete patient records to protect
    clinical history."""
    if current_user.get("role") != "patient" or current_user.get("patient_id") != patient_id:
        raise HTTPException(
            status_code=403,
            detail="Healthcare workers cannot delete patient records. Only a patient may delete their own account.",
        )

    linked_user = auth_store.get_user_by_patient_id(patient_id)

    deleted = document_store.delete_patient(patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Patient not found: {patient_id}")

    if linked_user is not None:
        auth_store.delete_user(linked_user["id"])

    return {"status": "deleted", "patient_id": patient_id}



@app.patch("/patients/{patient_id}")
def update_patient(patient_id: str, patient: PatientUpdate, current_user: dict = Depends(auth.require_patient_path_access)):
    """Partially update a patient's profile — only fields included in the
    request body are changed."""
    # exclude_unset means a field the client didn't send is left untouched,
    # rather than overwriting it with None.
    updates = patient.model_dump(exclude_unset=True)
    updated = document_store.update_patient(patient_id, **updates)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Patient not found: {patient_id}")
    return updated


@app.get("/patients/{patient_id}/documents")
def get_patient_documents(patient_id: str, current_user: dict = Depends(auth.require_patient_path_access)):
    """Retrieve every document uploaded for a specific patient."""
    if not document_store.patient_exists(patient_id):
        raise HTTPException(status_code=404, detail=f"Patient not found: {patient_id}")
    return {"patient_id": patient_id, "documents": document_store.list_documents_by_patient(patient_id)}


@app.get("/pipeline-stages/{stage_filename}", dependencies=[Depends(auth.require_role("healthcare_worker"))])
def get_stage_file(stage_filename: str):
    """Debug/intermediate pipeline output. Restricted to healthcare workers:
    these files aren't namespaced per-document, so they can contain another
    patient's raw extracted text from a recent request."""
    safe_name = os.path.basename(stage_filename)  # prevent path traversal
    path = os.path.join(CONFIG["output_dir"], safe_name)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Stage file not found: {safe_name}")

    return FileResponse(path)


# ---------------------------------------------------------------------------
# ADMIN ENDPOINTS — all require role="admin"
# ---------------------------------------------------------------------------

class AdminUserUpdate(BaseModel):
    """Fields an admin can change on any user account."""
    role: Optional[Literal["patient", "healthcare_worker", "admin"]] = None
    is_verified: Optional[bool] = None


@app.get("/admin/stats", dependencies=[Depends(auth.require_admin())])
def admin_get_stats():
    """System-wide statistics for the admin overview panel."""
    stats = document_store.get_system_stats()

    # Enrich with user-role counts from auth_store
    all_users = auth_store.list_all_users()
    stats["total_users"] = len(all_users)
    stats["users_by_role"] = {
        "patient": sum(1 for u in all_users if u["role"] == "patient"),
        "healthcare_worker": sum(1 for u in all_users if u["role"] == "healthcare_worker"),
        "admin": sum(1 for u in all_users if u["role"] == "admin"),
    }
    stats["verified_workers"] = sum(
        1 for u in all_users if u["role"] == "healthcare_worker" and u.get("is_verified")
    )
    stats["unverified_workers"] = sum(
        1 for u in all_users if u["role"] == "healthcare_worker" and not u.get("is_verified")
    )
    return stats


@app.get("/admin/users", dependencies=[Depends(auth.require_admin())])
def admin_list_users():
    """Return all user accounts (no credential fields). Admin only."""
    return {"users": auth_store.list_all_users()}


@app.patch("/admin/users/{user_id}", dependencies=[Depends(auth.require_admin())])
def admin_update_user(user_id: str, payload: AdminUserUpdate):
    """Promote/demote a user's role and/or change their verified status."""
    if payload.role is not None:
        result = auth_store.update_user_role(user_id, payload.role)
        if result is None:
            raise HTTPException(status_code=404, detail=f"User not found: {user_id}")

    if payload.is_verified is not None:
        result = auth_store.set_user_verified(user_id, payload.is_verified)
        if result is None:
            raise HTTPException(status_code=404, detail=f"User not found: {user_id}")

    updated = auth_store.get_user_by_id(user_id)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
    return auth.public_user(updated)


@app.delete("/admin/users/{user_id}", dependencies=[Depends(auth.require_admin())])
def admin_delete_user(user_id: str):
    """Delete any user account (admin-initiated). Also cascades to linked
    patient profile if the user is a patient."""
    user = auth_store.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")

    # Cascade: if it's a patient account, remove the linked patient profile too
    if user.get("role") == "patient" and user.get("patient_id"):
        document_store.admin_delete_patient(user["patient_id"])

    deleted = auth_store.delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
    return {"status": "deleted", "user_id": user_id}


@app.get("/admin/patients", dependencies=[Depends(auth.require_admin())])
def admin_list_patients():
    """Patient list with per-patient document counts. Admin only."""
    return {"patients": document_store.list_patients_with_doc_count()}


@app.delete("/admin/patients/{patient_id}", dependencies=[Depends(auth.require_admin())])
def admin_delete_patient(patient_id: str):
    """Admin-initiated patient deletion (unlike the regular DELETE /patients/{id}
    which only the patient themselves can call)."""
    # Also remove any linked user account
    linked_user = auth_store.get_user_by_patient_id(patient_id)
    deleted = document_store.admin_delete_patient(patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Patient not found: {patient_id}")
    if linked_user is not None:
        auth_store.delete_user(linked_user["id"])
    return {"status": "deleted", "patient_id": patient_id}




@app.get("/admin/documents", dependencies=[Depends(auth.require_admin())])
def admin_list_documents():
    """System-wide document list with extraction metadata. Admin only."""
    return {"documents": document_store.list_documents()}


# ---------------------------------------------------------------------------
# AI CHAT ENDPOINT
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    document_id: Optional[str] = None
    language: Optional[str] = None


@app.post("/chat")
async def chat_with_ai(
    req: ChatRequest,
    current_user: dict = Depends(auth.get_current_user),
):
    """
    Context-aware AI medical chatbot endpoint.
    If document_id is provided, the document's extracted medications and
    simplified explanation are attached as context to the LLM prompt.
    """
    from groq import Groq
    import os

    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    # Build document context if document_id provided
    context_block = ""
    if req.document_id:
        try:
            doc = document_store.get_document(req.document_id)
            if doc:
                auth.authorize_document_access(doc, current_user)
                ext = doc.get("extraction") or {}
                meds = ext.get("medications") or []
                simplified = ext.get("simplified_explanation") or ""
                translated = ext.get("translated_explanation") or ""
                doc_type = ext.get("document_type") or "medical document"

                meds_text = ""
                if meds:
                    meds_text = "\n".join(
                        f"- {m.get('name','Unknown')} | Dosage: {m.get('dosage','')} | "
                        f"Frequency: {m.get('frequency','')} | Duration: {m.get('duration','')} | "
                        f"Notes: {m.get('instruction','')}"
                        for m in meds
                    )

                context_block = f"""
The user has uploaded a {doc_type}. Here is what was extracted from it:

MEDICATIONS:
{meds_text if meds_text else "No structured medications found."}

SIMPLIFIED EXPLANATION (English):
{simplified or "Not available."}

TRANSLATED EXPLANATION:
{translated or "Not available."}
"""
        except Exception as e:
            print(f"[chat] Could not load document context: {e}")

    lang_instruction = ""
    if req.language and req.language.lower() not in ("en", "english"):
        lang_map = {
            "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
            "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
            "pa": "Punjabi", "ur": "Urdu",
        }
        lang_name = lang_map.get(req.language.lower(), req.language)
        lang_instruction = f"\nIMPORTANT: Respond in {lang_name}. Keep the response clear and in plain language."

    system_prompt = f"""You are Sehat Saathi, a friendly and knowledgeable medical assistant helping patients understand their medical documents and health questions.

Your role:
- Help users understand their medical documents, medications, dosages, and instructions
- Answer general health questions in simple, easy-to-understand language
- Never diagnose or replace professional medical advice — always recommend consulting a doctor for serious concerns
- Be warm, empathetic, and patient-friendly
- Keep responses concise and clear (3-5 sentences max unless more detail is needed)
{context_block}
{lang_instruction}"""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message},
            ],
            temperature=0.7,
            max_tokens=600,
        )
        reply = response.choices[0].message.content.strip()
        return {"response": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")


@app.post("/speech-to-text")
async def speech_to_text(
    audio: UploadFile = File(...),
    current_user: dict = Depends(auth.get_current_user),
):
    """
    Transcribe audio using Groq's free Whisper API.
    Accepts audio/webm, audio/ogg, audio/mp4, etc.
    Returns the transcribed text.
    """
    import os
    import tempfile
    from groq import Groq

    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    audio_bytes = await audio.read()
    suffix = ".webm"
    content_type = audio.content_type or ""
    if "ogg" in content_type:
        suffix = ".ogg"
    elif "mp4" in content_type or "m4a" in content_type:
        suffix = ".mp4"
    elif "wav" in content_type:
        suffix = ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=(f"audio{suffix}", f, content_type or "audio/webm"),
                response_format="text",
            )
        return {"text": transcription.strip() if isinstance(transcription, str) else transcription}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech transcription error: {str(e)}")
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
