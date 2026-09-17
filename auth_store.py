"""
auth_store.py

User accounts (login credentials + role) for the API. Kept separate from
document_store.py's patient *profile* data: a "patient"-role user is
linked to a row in the `patients` table via patient_id, but the login
credentials themselves live here in `users`.

Uses unified db_engine (SQLite locally or Supabase PostgreSQL online).
"""

import uuid
from datetime import datetime, timezone
import db_engine


def _now():
    return datetime.now(timezone.utc).isoformat()


def _init_db():
    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT,
            patient_id TEXT,
            worker_id TEXT,
            is_verified INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )


_init_db()


def create_user(email, password_hash, password_salt, role, name=None, patient_id=None,
                 worker_id=None, is_verified=False):
    """Insert a new user row. Raises ValueError if the email is already registered."""
    user_id = uuid.uuid4().hex[:12]
    existing = get_user_by_email(email)
    if existing:
        raise ValueError(f"Email already registered: {email}")

    db_engine.execute(
        """
        INSERT INTO users
            (id, email, password_hash, password_salt, role, name,
             patient_id, worker_id, is_verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, email.lower(), password_hash, password_salt, role, name,
            patient_id, worker_id, int(is_verified), _now(),
        ),
    )

    return get_user_by_id(user_id)


def get_user_by_email(email):
    return db_engine.fetchone("SELECT * FROM users WHERE email = ?", (email.lower(),))


def get_user_by_id(user_id):
    return db_engine.fetchone("SELECT * FROM users WHERE id = ?", (user_id,))


def get_user_by_patient_id(patient_id):
    """Find the login account (if any) linked to a given patient profile."""
    return db_engine.fetchone("SELECT * FROM users WHERE patient_id = ?", (patient_id,))


def delete_user(user_id):
    """Delete a login account by id. Returns False if it didn't exist."""
    rows_affected = db_engine.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return rows_affected > 0


# --------------------------------------------------------------------------
# Admin helpers
# --------------------------------------------------------------------------

def list_all_users():
    """Return all user accounts, stripping credential fields."""
    return db_engine.fetchall(
        "SELECT id, email, role, name, patient_id, worker_id, is_verified, created_at "
        "FROM users ORDER BY created_at DESC"
    )


def update_user_role(user_id, new_role):
    """Promote or demote a user's role."""
    db_engine.execute(
        "UPDATE users SET role = ? WHERE id = ?", (new_role, user_id)
    )
    return get_user_by_id(user_id)


def set_user_verified(user_id, is_verified: bool):
    """Grant or revoke a healthcare_worker's verified status."""
    db_engine.execute(
        "UPDATE users SET is_verified = ? WHERE id = ?",
        (int(is_verified), user_id),
    )
    return get_user_by_id(user_id)