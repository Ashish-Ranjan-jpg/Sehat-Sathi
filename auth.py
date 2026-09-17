"""
auth.py

Password hashing and JWT-based authentication for the API.

Two account roles exist: "patient" and "healthcare_worker". A JWT only
identifies *who* is calling (its "sub" claim is a user id) — the actual
role and patient_id used for every authorization decision are re-read
from the database on each request rather than trusted from token claims,
so a role change (or a patient being re-linked) takes effect immediately
without waiting for the old token to expire.
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

import auth_store

load_dotenv()

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = "dev-only-insecure-secret-change-me"
    print(
        "[auth] WARNING: JWT_SECRET_KEY is not set in the environment. "
        "Using an insecure development default. Set a real JWT_SECRET_KEY "
        "before deploying this anywhere real — anyone who knows this "
        "default value can forge valid tokens."
    )

HEALTHCARE_WORKER_INVITE_CODE = os.environ.get("HEALTHCARE_WORKER_INVITE_CODE")
if not HEALTHCARE_WORKER_INVITE_CODE:
    HEALTHCARE_WORKER_INVITE_CODE = "dev-only-invite-code-change-me"
    print(
        "[auth] WARNING: HEALTHCARE_WORKER_INVITE_CODE is not set in the "
        "environment. Using an insecure development default — anyone who "
        "knows this default can register as a verified healthcare_worker. "
        "Set a real HEALTHCARE_WORKER_INVITE_CODE (and distribute it only "
        "to real staff) before deploying this anywhere real."
    )


def is_valid_healthcare_worker_invite_code(code):
    """Registration-time gate for role='healthcare_worker'. This is a
    placeholder verification mechanism — a shared code distributed to real
    staff — swap in a real credential/license check before production use."""
    return bool(code) and secrets.compare_digest(code, HEALTHCARE_WORKER_INVITE_CODE)


ADMIN_INVITE_CODE = os.environ.get("ADMIN_INVITE_CODE")
if not ADMIN_INVITE_CODE:
    ADMIN_INVITE_CODE = "dev-only-admin-code-change-me"
    print(
        "[auth] WARNING: ADMIN_INVITE_CODE is not set in the environment. "
        "Using an insecure development default — anyone who knows this "
        "default can register as an admin. Set a real ADMIN_INVITE_CODE "
        "before deploying this anywhere real."
    )


def is_valid_admin_invite_code(code):
    """Registration-time gate for role='admin'. Same pattern as the
    healthcare-worker gate — swap in a real mechanism before production."""
    return bool(code) and secrets.compare_digest(code, ADMIN_INVITE_CODE)


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h default

# tokenUrl just tells the interactive docs ("Authorize" button) where to
# send a login request — it doesn't affect how tokens are actually verified.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# --------------------------------------------------------------------------
# Password hashing — stdlib PBKDF2, no extra dependency required
# --------------------------------------------------------------------------

_PBKDF2_ITERATIONS = 200_000


def hash_password(password):
    """Returns (password_hash, password_salt), both hex strings, to be stored
    as separate columns."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    )
    return digest.hex(), salt


def verify_password(password, stored_hash, stored_salt):
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(stored_salt), _PBKDF2_ITERATIONS
    )
    # constant-time comparison so response timing doesn't leak how much of
    # the hash matched
    return secrets.compare_digest(digest.hex(), stored_hash)


# --------------------------------------------------------------------------
# JWT issuance
# --------------------------------------------------------------------------

def create_access_token(user_id):
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# --------------------------------------------------------------------------
# FastAPI dependencies
# --------------------------------------------------------------------------

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Decode the bearer token to get a user id, then load that user fresh
    from the database. Raises 401 if the token is missing/invalid/expired
    or no longer matches a real user."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise _credentials_exception
    except jwt.PyJWTError:
        raise _credentials_exception

    user = auth_store.get_user_by_id(user_id)
    if user is None:
        raise _credentials_exception
    return user


def require_role(*allowed_roles):
    """
    FastAPI dependency factory. Use as:
        @app.post("/patients", dependencies=[Depends(require_role("healthcare_worker"))])
    """
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {', '.join(allowed_roles)}",
            )
        # Holding the "healthcare_worker" role isn't enough on its own —
        # anyone could register with that role. is_verified is set only
        # when registration presented a valid invite code (see
        # api.py:register), so this is what actually gates access to
        # other patients' data.
        if current_user["role"] == "healthcare_worker" and not current_user.get("is_verified"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This healthcare_worker account has not been verified yet.",
            )
        return current_user
    return checker


def require_patient_path_access(patient_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency for routes shaped like /patients/{patient_id}...:
    a healthcare_worker may access any patient; a patient may only access
    their own record. FastAPI auto-injects `patient_id` from the path
    parameter of the same name.
    """
    if current_user["role"] == "healthcare_worker" and current_user.get("is_verified"):
        return current_user
    if current_user["role"] == "patient" and current_user.get("patient_id") == patient_id:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to access this patient's data",
    )


def authorize_document_access(document_record, current_user):
    """
    Call after fetching a document record (its patient_id isn't known until
    then, so this can't be a pure path-based dependency like the one above).
    """
    if current_user["role"] == "healthcare_worker" and current_user.get("is_verified"):
        return
    if current_user["role"] == "patient" and document_record.get("patient_id") == current_user.get("patient_id"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to access this document",
    )


def public_user(user):
    """Strip credential fields before a user record ever leaves the server."""
    return {k: v for k, v in user.items() if k not in ("password_hash", "password_salt")}


def require_admin():
    """
    FastAPI dependency factory. Use as:
        @app.get("/admin/...", dependencies=[Depends(require_admin())])
    Rejects any token that isn't from an 'admin'-role account.
    """
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required.",
            )
        return current_user
    return checker