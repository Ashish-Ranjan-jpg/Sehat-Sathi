"""
chat_store.py

Persistent Chat History Store for Sehat Saathi AI Health Assistant.
Uses db_engine (SQLite locally or Supabase PostgreSQL online).
"""

import json
import uuid
from datetime import datetime, timezone
import db_engine


def _now():
    return datetime.now(timezone.utc).isoformat()


def _init_db():
    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            source TEXT,
            medlineplus_topic TEXT,
            document_id TEXT,
            language TEXT,
            created_at TEXT NOT NULL
        )
        """
    )


_init_db()


def create_session(user_id: str, title: str) -> dict:
    """Create a new chat session for a user."""
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    now_str = _now()
    clean_title = (title or "New Conversation").strip()
    if len(clean_title) > 60:
        clean_title = clean_title[:57] + "..."

    db_engine.execute(
        """
        INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (session_id, user_id, clean_title, now_str, now_str),
    )
    return get_session(session_id, user_id)


def get_session(session_id: str, user_id: str) -> dict:
    """Fetch a single chat session by ID for a user."""
    return db_engine.fetchone(
        "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, user_id),
    )


def list_sessions(user_id: str) -> list:
    """List all chat sessions for a user, sorted by update time descending."""
    sessions = db_engine.fetchall(
        """
        SELECT s.*, COUNT(m.id) as message_count
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON s.id = m.session_id
        WHERE s.user_id = ?
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        """,
        (user_id,),
    )
    return sessions


def add_message(
    session_id: str,
    user_id: str,
    sender: str,
    text: str,
    source: str = None,
    medlineplus_topic: dict = None,
    document_id: str = None,
    language: str = None,
) -> dict:
    """Add a message (user or bot) to a session."""
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now_str = _now()
    topic_json = json.dumps(medlineplus_topic) if medlineplus_topic else None

    # Ensure session exists or create it
    session = get_session(session_id, user_id)
    if not session:
        title = text[:50] + "..." if len(text) > 50 else text
        create_session_with_id(session_id, user_id, title)
    else:
        # Update session timestamp
        db_engine.execute(
            "UPDATE chat_sessions SET updated_at = ? WHERE id = ? AND user_id = ?",
            (now_str, session_id, user_id),
        )

    db_engine.execute(
        """
        INSERT INTO chat_messages
            (id, session_id, user_id, sender, text, source, medlineplus_topic, document_id, language, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            msg_id,
            session_id,
            user_id,
            sender,
            text,
            source,
            topic_json,
            document_id,
            language,
            now_str,
        ),
    )

    return {
        "id": msg_id,
        "session_id": session_id,
        "user_id": user_id,
        "sender": sender,
        "text": text,
        "source": source,
        "medlineplus_topic": medlineplus_topic,
        "document_id": document_id,
        "language": language,
        "created_at": now_str,
    }


def create_session_with_id(session_id: str, user_id: str, title: str) -> dict:
    """Insert session with explicit ID."""
    now_str = _now()
    clean_title = (title or "New Conversation").strip()
    if len(clean_title) > 60:
        clean_title = clean_title[:57] + "..."

    db_engine.execute(
        """
        INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (session_id, user_id, clean_title, now_str, now_str),
    )
    return get_session(session_id, user_id)


def get_session_messages(session_id: str, user_id: str) -> list:
    """Get all messages for a session formatted for API response."""
    raw_messages = db_engine.fetchall(
        """
        SELECT * FROM chat_messages
        WHERE session_id = ? AND user_id = ?
        ORDER BY created_at ASC
        """,
        (session_id, user_id),
    )

    messages = []
    for r in raw_messages:
        topic_data = None
        if r.get("medlineplus_topic"):
            try:
                topic_data = json.loads(r["medlineplus_topic"])
            except Exception:
                topic_data = None

        messages.append(
            {
                "id": r["id"],
                "session_id": r["session_id"],
                "sender": r["sender"],
                "text": r["text"],
                "source": r.get("source") or "ai_generated",
                "medlineplus_topic": topic_data,
                "document_id": r.get("document_id"),
                "language": r.get("language"),
                "created_at": r["created_at"],
            }
        )
    return messages


def delete_session(session_id: str, user_id: str) -> bool:
    """Delete session and all associated messages for user."""
    db_engine.execute(
        "DELETE FROM chat_messages WHERE session_id = ? AND user_id = ?",
        (session_id, user_id),
    )
    affected = db_engine.execute(
        "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, user_id),
    )
    return affected > 0


def clear_user_history(user_id: str) -> bool:
    """Delete all sessions and messages for a user."""
    db_engine.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,))
    db_engine.execute("DELETE FROM chat_sessions WHERE user_id = ?", (user_id,))
    return True
