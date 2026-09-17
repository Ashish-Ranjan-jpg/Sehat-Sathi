"""
storage.py

File storage helper for uploaded medical documents (PDFs, Images).
Supports both local disk storage (uploaded_documents/) and Supabase Cloud Storage.
"""

import os
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://rdkskzwqhucgkkrovqbo.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJka3NrendxaHVjZ2trcm92cWJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU4ODczNSwiZXhwIjoyMTA1MTY0NzM1fQ.8zIPmxafwvC4S4DU3KAZAO-fssVt2SISfbsYCq8Qg0c",
)
BUCKET_NAME = os.environ.get("SUPABASE_STORAGE_BUCKET", "documents")
LOCAL_DIR = "uploaded_documents"

os.makedirs(LOCAL_DIR, exist_ok=True)


def is_supabase_storage_enabled():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def save_file(filename: str, content: bytes, content_type: str = "application/octet-stream") -> str:
    """
    Saves file to Supabase Storage if configured, otherwise saves to local disk.
    Returns the stored_path string to save in DB.
    """
    # Always write to local disk as well for fast local pipeline reading
    local_path = os.path.join(LOCAL_DIR, filename)
    with open(local_path, "wb") as f:
        f.write(content)

    if is_supabase_storage_enabled():
        try:
            url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{BUCKET_NAME}/{filename}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apiKey": SUPABASE_SERVICE_ROLE_KEY,
            }
            resp = requests.post(
                url,
                headers=headers,
                files={"file": (filename, content, content_type)},
                timeout=10,
            )
            if resp.status_code in (200, 201):
                return f"supabase://{BUCKET_NAME}/{filename}"
        except Exception as e:
            print(f"[storage] Supabase upload error (falling back to local): {e}")

    return local_path


def read_file_bytes(stored_path: str) -> bytes:
    """Reads file bytes from Supabase Storage or local disk."""
    if stored_path.startswith("supabase://"):
        try:
            parts = stored_path.replace("supabase://", "").split("/", 1)
            bucket = parts[0]
            filename = parts[1]
            url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/authenticated/{bucket}/{filename}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apiKey": SUPABASE_SERVICE_ROLE_KEY,
            }
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                return resp.content
        except Exception as e:
            print(f"[storage] Error reading from Supabase Storage: {e}")

    # Fallback to local disk
    local_filename = os.path.basename(stored_path)
    local_path = os.path.join(LOCAL_DIR, local_filename)
    if os.path.exists(local_path):
        with open(local_path, "rb") as f:
            return f.read()

    raise FileNotFoundError(f"File not found: {stored_path}")


def delete_file(stored_path: str):
    """Deletes file from Supabase Storage and local disk."""
    local_filename = os.path.basename(stored_path)
    local_path = os.path.join(LOCAL_DIR, local_filename)
    if os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass

    if stored_path.startswith("supabase://") and is_supabase_storage_enabled():
        try:
            parts = stored_path.replace("supabase://", "").split("/", 1)
            bucket = parts[0]
            filename = parts[1]
            url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{filename}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apiKey": SUPABASE_SERVICE_ROLE_KEY,
            }
            requests.delete(url, headers=headers, timeout=10)
        except Exception as e:
            print(f"[storage] Error deleting from Supabase Storage: {e}")
