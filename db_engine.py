"""
db_engine.py

Unified database execution engine supporting SQLite (local fallback)
and PostgreSQL (Supabase / Render).

If DATABASE_URL environment variable is set, it uses psycopg2 to connect to
PostgreSQL. Otherwise, it falls back to local SQLite (documents.db).
"""

import os
import sqlite3
import threading
from contextlib import contextmanager

_write_lock = threading.Lock()
DB_PATH = "documents.db"


_has_postgres_driver = None

def is_postgres():
    global _has_postgres_driver
    url = os.environ.get("DATABASE_URL")
    if not url:
        return False
    if _has_postgres_driver is None:
        try:
            import psycopg2
            _has_postgres_driver = True
        except ImportError:
            _has_postgres_driver = False
    return _has_postgres_driver


def _get_connection_string():
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    # Fix brackets around password if present
    if "postgres:[" in url:
        url = url.replace("postgres:[", "postgres:").replace("]@db.", "@db.")
    # Handle direct IPv6 host -> pooler host if needed
    if "@db." in url and ".supabase.co" in url:
        # Check if user needs pooler format
        parts = url.split("@db.")
        if len(parts) == 2:
            sub = parts[1].split(".supabase.co")
            project_ref = sub[0]
            rest = sub[1] if len(sub) > 1 else ":5432/postgres"
            url = f"{parts[0]}.{project_ref}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    return url


@contextmanager
def get_db():
    url = _get_connection_string()
    if url:
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
            try:
                yield conn
            finally:
                conn.close()
            return
        except ImportError:
            pass

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _format_sql(sql: str) -> str:
    if is_postgres():
        # SQLite "INSERT OR IGNORE INTO table" -> Postgres "INSERT INTO table ... ON CONFLICT DO NOTHING"
        if "INSERT OR IGNORE INTO" in sql:
            sql = sql.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            if "ON CONFLICT" not in sql:
                sql = sql + " ON CONFLICT DO NOTHING"

        # SQLite ? -> Postgres %s
        sql = sql.replace("?", "%s")
    return sql


def execute(sql: str, params: tuple = ()):
    formatted_sql = _format_sql(sql)
    with _write_lock, get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(formatted_sql, params)
        conn.commit()
        rowcount = cursor.rowcount
        cursor.close()
        return rowcount


def fetchone(sql: str, params: tuple = ()):
    formatted_sql = _format_sql(sql)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(formatted_sql, params)
        row = cursor.fetchone()
        cursor.close()
        return dict(row) if row else None


def fetchall(sql: str, params: tuple = ()):
    formatted_sql = _format_sql(sql)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(formatted_sql, params)
        rows = cursor.fetchall()
        cursor.close()
        return [dict(r) for r in rows] if rows else []
