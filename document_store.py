"""
document_store.py

Persistence layer for patients, uploaded documents, and their pipeline
extraction results. Uses db_engine (SQLite locally or Supabase PostgreSQL online).

Four tables:
  - patients
  - healthcare_workers
  - documents
  - medical_extractions
"""

import os
import json
import uuid
from datetime import datetime, timezone
import db_engine


def _now():
    return datetime.now(timezone.utc).isoformat()


def _init_db():
    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            name TEXT,
            phone_number TEXT,
            age INTEGER,
            gender TEXT,
            preferred_language TEXT,
            blood_group TEXT,
            allergies TEXT,
            emergency_contact TEXT,
            medical_conditions TEXT
        )
        """
    )

    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS healthcare_workers (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            name TEXT,
            employee_id TEXT,
            department TEXT,
            phone_number TEXT
        )
        """
    )

    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            patient_id TEXT,
            original_filename TEXT,
            stored_filename TEXT,
            stored_path TEXT,
            content_type TEXT,
            uploaded_at TEXT,
            result_json TEXT
        )
        """
    )

    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS medical_extractions (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            patient_id TEXT,
            document_type TEXT,
            raw_text TEXT,
            processed_data TEXT,
            simplified_text TEXT,
            translated_text TEXT,
            language TEXT,
            processed_at TEXT
        )
        """
    )


_init_db()


# --------------------------------------------------------------------------
# Patients
# --------------------------------------------------------------------------

def get_or_create_patient(patient_id=None):
    """Find-or-create a patient by ID only (no profile fields)."""
    resolved_id = patient_id or uuid.uuid4().hex[:12]

    db_engine.execute(
        "INSERT OR IGNORE INTO patients (id, created_at) VALUES (?, ?)",
        (resolved_id, _now()),
    )

    return resolved_id


def register_patient(name=None, phone_number=None, age=None, gender=None,
                      preferred_language=None):
    """Create a new patient with a full profile."""
    patient_id = uuid.uuid4().hex[:12]

    db_engine.execute(
        """
        INSERT INTO patients
            (id, created_at, name, phone_number, age, gender, preferred_language)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (patient_id, _now(), name, phone_number, age, gender, preferred_language),
    )

    return get_patient(patient_id)


def get_patient(patient_id):
    return db_engine.fetchone(
        "SELECT * FROM patients WHERE id = ?", (patient_id,)
    )


_UPDATABLE_PATIENT_FIELDS = {
    "name",
    "phone_number",
    "age",
    "gender",
    "preferred_language",
    "blood_group",
    "allergies",
    "emergency_contact",
    "medical_conditions",
}


def update_patient(patient_id, **fields):
    """Partially update a patient's profile."""
    if not patient_exists(patient_id):
        return None

    updates = {k: v for k, v in fields.items() if k in _UPDATABLE_PATIENT_FIELDS}
    if not updates:
        return get_patient(patient_id)

    set_clause = ", ".join(f"{col} = ?" for col in updates)
    values = list(updates.values()) + [patient_id]

    db_engine.execute(f"UPDATE patients SET {set_clause} WHERE id = ?", values)

    return get_patient(patient_id)


def patient_exists(patient_id):
    row = db_engine.fetchone(
        "SELECT 1 FROM patients WHERE id = ?", (patient_id,)
    )
    return row is not None


def list_patients():
    """Every registered patient profile."""
    return db_engine.fetchall("SELECT * FROM patients ORDER BY created_at DESC")


def delete_patient(patient_id):
    """Delete a patient profile along with every document and extraction linked to it."""
    if not patient_exists(patient_id):
        return False

    for doc in list_documents_by_patient(patient_id):
        delete_document(doc["id"])

    db_engine.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
    return True


# --------------------------------------------------------------------------
# Healthcare workers
# --------------------------------------------------------------------------

def register_healthcare_worker(name=None, employee_id=None, department=None, phone_number=None):
    """Create a healthcare worker's profile."""
    worker_id = uuid.uuid4().hex[:12]

    db_engine.execute(
        """
        INSERT INTO healthcare_workers
            (id, created_at, name, employee_id, department, phone_number)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (worker_id, _now(), name, employee_id, department, phone_number),
    )

    return get_healthcare_worker(worker_id)


def get_healthcare_worker(worker_id):
    return db_engine.fetchone(
        "SELECT * FROM healthcare_workers WHERE id = ?", (worker_id,)
    )


# --------------------------------------------------------------------------
# Documents
# --------------------------------------------------------------------------

def create_document(document_id, patient_id, original_filename,
                     stored_filename, stored_path, content_type):
    """Persist metadata for a newly uploaded file."""
    db_engine.execute(
        """
        INSERT INTO documents
            (id, patient_id, original_filename, stored_filename,
             stored_path, content_type, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            document_id,
            patient_id,
            original_filename,
            stored_filename,
            stored_path,
            content_type,
            _now(),
        ),
    )


def list_documents():
    """Lightweight summary of every uploaded document."""
    return db_engine.fetchall(
        """
        SELECT
            d.id, d.patient_id, d.original_filename, d.content_type,
            d.uploaded_at, e.document_type
        FROM documents d
        LEFT JOIN medical_extractions e ON e.document_id = d.id
        ORDER BY d.uploaded_at DESC
        """
    )


def list_documents_by_patient(patient_id):
    """Same summary shape as list_documents(), scoped to one patient."""
    return db_engine.fetchall(
        """
        SELECT
            d.id, d.patient_id, d.original_filename, d.content_type,
            d.uploaded_at, e.document_type
        FROM documents d
        LEFT JOIN medical_extractions e ON e.document_id = d.id
        WHERE d.patient_id = ?
        ORDER BY d.uploaded_at DESC
        """,
        (patient_id,),
    )


def get_document(document_id):
    """Return one document's metadata plus its extraction (if any)."""
    doc_row = db_engine.fetchone(
        "SELECT * FROM documents WHERE id = ?", (document_id,)
    )
    if doc_row is None:
        return None

    record = dict(doc_row)
    record.pop("result_json", None)

    extraction_row = db_engine.fetchone(
        "SELECT * FROM medical_extractions WHERE document_id = ? "
        "ORDER BY processed_at DESC LIMIT 1",
        (document_id,),
    )

    record["extraction"] = _extraction_row_to_dict(extraction_row) if extraction_row else None
    return record


import storage

def delete_document(document_id):
    """Delete a document, its extraction(s), and its stored file."""
    record = get_document(document_id)
    if record is None:
        return False

    db_engine.execute("DELETE FROM medical_extractions WHERE document_id = ?", (document_id,))
    db_engine.execute("DELETE FROM documents WHERE id = ?", (document_id,))

    stored_path = record.get("stored_path")
    if stored_path:
        storage.delete_file(stored_path)

    return True


# --------------------------------------------------------------------------
# Medical extractions
# --------------------------------------------------------------------------

def create_extraction(document_id, patient_id, document_type, raw_text,
                       processed_data, simplified_text, translated_text,
                       language):
    """Persist one pipeline run's output for a document."""
    extraction_id = uuid.uuid4().hex[:12]
    db_engine.execute(
        """
        INSERT INTO medical_extractions
            (id, document_id, patient_id, document_type, raw_text,
             processed_data, simplified_text, translated_text,
             language, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            extraction_id,
            document_id,
            patient_id,
            document_type,
            raw_text,
            json.dumps(processed_data, ensure_ascii=False),
            simplified_text,
            translated_text,
            language,
            _now(),
        ),
    )
    return extraction_id


def get_extraction_by_document_id(document_id):
    row = db_engine.fetchone(
        "SELECT * FROM medical_extractions WHERE document_id = ? "
        "ORDER BY processed_at DESC LIMIT 1",
        (document_id,),
    )
    return _extraction_row_to_dict(row) if row else None


def _extraction_row_to_dict(row):
    record = dict(row)
    raw_meds = record.get("processed_data")
    if isinstance(raw_meds, str):
        try:
            meds = json.loads(raw_meds)
        except Exception:
            meds = []
    elif isinstance(raw_meds, list):
        meds = raw_meds
    else:
        meds = []

    record["processed_data"] = meds
    record["medications"] = meds
    record["simplified_explanation"] = record.get("simplified_text")
    record["translated_explanation"] = record.get("translated_text")
    return record


# --------------------------------------------------------------------------
# Admin helpers
# --------------------------------------------------------------------------

def get_system_stats():
    """Single-query summary of system-wide metrics for the admin overview panel."""
    patients_res = db_engine.fetchone("SELECT COUNT(*) as count FROM patients")
    docs_res = db_engine.fetchone("SELECT COUNT(*) as count FROM documents")
    exts_res = db_engine.fetchone("SELECT COUNT(*) as count FROM medical_extractions")
    workers_res = db_engine.fetchone("SELECT COUNT(*) as count FROM healthcare_workers")

    total_patients = patients_res["count"] if patients_res else 0
    total_documents = docs_res["count"] if docs_res else 0
    total_extractions = exts_res["count"] if exts_res else 0
    total_workers = workers_res["count"] if workers_res else 0

    language_breakdown = db_engine.fetchall(
        """
        SELECT language, COUNT(*) as count
        FROM medical_extractions
        WHERE language IS NOT NULL
        GROUP BY language
        ORDER BY count DESC
        """
    )

    recent_uploads = db_engine.fetchall(
        """
        SELECT d.id, d.patient_id, d.original_filename, d.uploaded_at, e.document_type
        FROM documents d
        LEFT JOIN medical_extractions e ON e.document_id = d.id
        ORDER BY d.uploaded_at DESC
        LIMIT 10
        """
    )

    doc_type_breakdown = db_engine.fetchall(
        """
        SELECT document_type, COUNT(*) as count
        FROM medical_extractions
        WHERE document_type IS NOT NULL
        GROUP BY document_type
        ORDER BY count DESC
        """
    )

    return {
        "total_patients": total_patients,
        "total_documents": total_documents,
        "total_extractions": total_extractions,
        "total_healthcare_workers": total_workers,
        "language_breakdown": language_breakdown,
        "doc_type_breakdown": doc_type_breakdown,
        "recent_uploads": recent_uploads,
    }


def list_patients_with_doc_count():
    """Extended patient list for the admin panel, including document count per patient."""
    return db_engine.fetchall(
        """
        SELECT p.*, COUNT(d.id) AS doc_count
        FROM patients p
        LEFT JOIN documents d ON d.patient_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
        """
    )


def admin_delete_patient(patient_id):
    """Admin-initiated patient deletion."""
    return delete_patient(patient_id)