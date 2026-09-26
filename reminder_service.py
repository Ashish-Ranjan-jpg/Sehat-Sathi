"""
reminder_service.py

Medication Reminder System & Caregiver Alert Service.
- Manages medication reminder schedules and daily dose logs.
- Dispatches SMS/WhatsApp notifications via Twilio (with fallback simulation).
- Monitors missed doses (15-min grace period) and automatically alerts Caregivers.
"""

import os
import json
import uuid
import threading
import time
from datetime import datetime, timezone, timedelta
import db_engine
from dotenv import load_dotenv

env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_file)

# Grace period in minutes before a dose is marked as missed
MISSED_GRACE_MINUTES = 15


# ---------------------------------------------------------------------------
# Database Initialization
# ---------------------------------------------------------------------------

def _init_reminder_db():
    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS medication_reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            patient_id TEXT,
            patient_name TEXT,
            created_by_worker_id TEXT,
            document_id TEXT,
            medicine_name TEXT NOT NULL,
            dosage TEXT,
            frequency TEXT DEFAULT 'daily',
            times TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT,
            patient_phone TEXT,
            caregiver_name TEXT,
            caregiver_phone TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL
        )
        """
    )

    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS medication_logs (
            id TEXT PRIMARY KEY,
            reminder_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            medicine_name TEXT NOT NULL,
            dosage TEXT,
            scheduled_time TEXT NOT NULL,
            status TEXT DEFAULT 'scheduled',
            notified_patient INT DEFAULT 0,
            notified_caregiver INT DEFAULT 0,
            action_time TEXT,
            created_at TEXT NOT NULL
        )
        """
    )

    db_engine.execute(
        """
        CREATE TABLE IF NOT EXISTS in_app_notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'medication',
            is_read INT DEFAULT 0,
            related_id TEXT,
            created_at TEXT NOT NULL
        )
        """
    )


_init_reminder_db()

# Migrate existing table to add new columns if they don't exist yet
for _col, _default in [
    ("patient_id", "NULL"),
    ("patient_name", "NULL"),
    ("created_by_worker_id", "NULL"),
]:
    try:
        db_engine.execute(f"ALTER TABLE medication_reminders ADD COLUMN {_col} TEXT DEFAULT {_default}")
    except Exception:
        pass  # Column already exists


# ---------------------------------------------------------------------------
# Twilio WhatsApp Sandbox Notification Engine
# ---------------------------------------------------------------------------

def _is_valid_e164_phone(phone: str) -> bool:
    """Check if phone number is a plausible real international phone number."""
    if not phone:
        return False
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) < 10 or len(digits) > 15:
        return False
    if digits in ("123456789", "1234567890", "0000000000", "9999999999"):
        return False
    return True


def _to_whatsapp(phone: str) -> str:
    """Ensure a phone number has the 'whatsapp:' prefix required by Twilio WhatsApp."""
    if not phone:
        return phone
    phone = phone.strip()
    if not phone.startswith("+") and not phone.startswith("whatsapp:"):
        if len(phone) == 10 and phone.isdigit():
            phone = f"+91{phone}"
        elif len(phone) > 10 and phone.isdigit():
            phone = f"+{phone}"

    if not phone.startswith("whatsapp:"):
        return f"whatsapp:{phone}"
    return phone


def _send_twilio_sms(to_phone, body_text):
    """
    Send a WhatsApp message via Twilio WhatsApp Sandbox.
    If Twilio credentials are missing in .env or target is a dummy number (e.g. 123456789),
    fallback to clean console simulation.

    SETUP: Recipients must first opt-in to the sandbox by sending
    'join <sandbox-keyword>' to whatsapp:+14155238886 on WhatsApp.
    """
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_phone = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    raw_phone = (to_phone or "").strip()
    is_valid_number = _is_valid_e164_phone(raw_phone)

    if account_sid and auth_token and is_valid_number:
        from_phone = _to_whatsapp(from_phone)
        to_whatsapp = _to_whatsapp(raw_phone)
        try:
            from twilio.rest import Client
            from twilio.base.exceptions import TwilioRestException
            client = Client(account_sid, auth_token)
            message = client.messages.create(
                body=body_text,
                from_=from_phone,
                to=to_whatsapp
            )
            print(f"[TWILIO WHATSAPP SUCCESS] Sent to {to_whatsapp} (SID: {message.sid})")
            return True
        except TwilioRestException as e:
            code = e.code
            if code == 21654:
                print(
                    f"[TWILIO WHATSAPP] Recipient {to_whatsapp} has NOT joined the sandbox.\n"
                    f"  ACTION: Ask them to send 'join <sandbox-keyword>' to WhatsApp +14155238886.\n"
                    f"  Find your keyword at: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
                )
            elif code == 21408:
                print(
                    f"[TWILIO WHATSAPP] Geographic permissions not enabled for {to_whatsapp}.\n"
                    f"  ACTION: Enable the country in Twilio Console -> Messaging -> Geo-permissions."
                )
            elif code in (21211, 21614, 21606):
                print(f"[TWILIO WHATSAPP] Invalid or dummy phone number: {to_whatsapp} - falling back to simulation")
            else:
                print(f"[TWILIO WHATSAPP ERROR] Failed to send to {to_whatsapp} (Code {code}): {e.msg}")
            return False
        except Exception as e:
            print(f"[TWILIO WHATSAPP ERROR] Unexpected error sending to {to_whatsapp}: {e}")
            return False
    else:
        # Fallback simulation mode
        print("\n" + "=" * 60)
        print(f"[TWILIO WHATSAPP SIMULATION -> {_to_whatsapp(raw_phone) if raw_phone else 'Patient'}]")
        print(f"Message: {body_text}")
        print("=" * 60 + "\n")
        return True


def send_patient_reminder(medicine_name, dosage, time_str, patient_phone=None):
    body = (
        f"\u23f0 SEHAT SAATHI REMINDER: It's time to take your medication!\n"
        f"\u2022 Medicine: {medicine_name}\n"
        f"\u2022 Dosage: {dosage or 'As prescribed'}\n"
        f"\u2022 Time: {time_str}\n"
        f"Please log into Sehat Saathi to mark it as taken."
    )
    # Use patient's phone if provided, otherwise skip (simulation)
    return _send_twilio_sms(patient_phone, body)


def send_caregiver_alert(medicine_name, dosage, scheduled_time_str, patient_name, caregiver_name, caregiver_phone):
    body = (
        f"\U0001f6a8 SEHAT SAATHI MISSED DOSE ALERT!\n"
        f"Dear {caregiver_name or 'Caregiver'},\n"
        f"Patient {patient_name or 'Your relative'} has MISSED their scheduled dose:\n"
        f"\u2022 Medicine: {medicine_name} ({dosage or 'As prescribed'})\n"
        f"\u2022 Scheduled Time: {scheduled_time_str}\n"
        f"Please check in with them to ensure their health and safety."
    )
    return _send_twilio_sms(caregiver_phone, body)


# ---------------------------------------------------------------------------
# Schedule & Log Management
# ---------------------------------------------------------------------------

def create_reminder(user_id, medicine_name, dosage, times, start_date=None, end_date=None,
                    frequency="daily", patient_phone=None, caregiver_name=None,
                    caregiver_phone=None, document_id=None,
                    patient_id=None, patient_name=None, created_by_worker_id=None):
    """Create a new medication reminder schedule."""
    reminder_id = uuid.uuid4().hex[:12]
    now_iso = datetime.now(timezone.utc).isoformat()

    if isinstance(times, list):
        times_json = json.dumps(times)
    else:
        times_json = json.dumps([t.strip() for t in str(times).split(",") if t.strip()])

    if not start_date:
        start_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    db_engine.execute(
        """
        INSERT INTO medication_reminders
            (id, user_id, patient_id, patient_name, created_by_worker_id, document_id,
             medicine_name, dosage, frequency, times,
             start_date, end_date, patient_phone, caregiver_name, caregiver_phone,
             status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        """,
        (
            reminder_id,
            user_id,
            patient_id or "",
            patient_name or "",
            created_by_worker_id or "",
            document_id,
            medicine_name,
            dosage or "",
            frequency,
            times_json,
            start_date,
            end_date or "",
            patient_phone or "",
            caregiver_name or "",
            caregiver_phone or "",
            now_iso,
        )
    )

    # Immediately generate today's dose logs for this reminder
    parsed_times = json.loads(times_json)
    _generate_dose_logs_for_reminder(reminder_id, user_id, medicine_name, dosage, parsed_times)

    # Dispatch in-app notification for newly scheduled reminder
    time_str = ", ".join(parsed_times) if isinstance(parsed_times, list) else str(parsed_times)
    create_in_app_notification(
        user_id=user_id,
        title=f"⏰ Reminder Scheduled: {medicine_name}",
        message=f"Medication reminder set for {medicine_name} ({dosage or 'As prescribed'}) at {time_str}.",
        notif_type="system",
        related_id=reminder_id
    )

    return get_reminder(reminder_id)


# ---------------------------------------------------------------------------
# In-App Notification Service Methods
# ---------------------------------------------------------------------------

def create_in_app_notification(user_id, title, message, notif_type="medication", related_id=None):
    """Create a persistent in-app notification for the specified user."""
    notif_id = uuid.uuid4().hex[:12]
    now_iso = datetime.now().isoformat()
    db_engine.execute(
        """
        INSERT INTO in_app_notifications (id, user_id, title, message, type, is_read, related_id, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        """,
        (notif_id, user_id, title, message, notif_type, related_id, now_iso)
    )
    return db_engine.fetchone("SELECT * FROM in_app_notifications WHERE id = ?", (notif_id,))


def get_user_notifications(user_id, limit=50):
    """Retrieve all in-app notifications for the user ordered by creation date."""
    rows = db_engine.fetchall(
        "SELECT * FROM in_app_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit)
    )
    unread_row = db_engine.fetchone(
        "SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = ? AND is_read = 0",
        (user_id,)
    )
    unread_count = unread_row["count"] if unread_row else 0
    return {"notifications": rows, "unread_count": unread_count}


def mark_notification_as_read(notification_id, user_id):
    """Mark a single notification as read."""
    db_engine.execute(
        "UPDATE in_app_notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        (notification_id, user_id)
    )
    return True


def mark_all_notifications_as_read(user_id):
    """Mark all notifications as read for the user."""
    db_engine.execute(
        "UPDATE in_app_notifications SET is_read = 1 WHERE user_id = ?",
        (user_id,)
    )
    return True


def delete_notification(notification_id, user_id):
    """Delete a single notification."""
    db_engine.execute(
        "DELETE FROM in_app_notifications WHERE id = ? AND user_id = ?",
        (notification_id, user_id)
    )
    return True


def clear_all_notifications(user_id):
    """Delete all notifications for the user."""
    db_engine.execute(
        "DELETE FROM in_app_notifications WHERE user_id = ?",
        (user_id,)
    )
    return True


def get_reminder(reminder_id):
    row = db_engine.fetchone("SELECT * FROM medication_reminders WHERE id = ?", (reminder_id,))
    if row and isinstance(row.get("times"), str):
        try:
            row["times"] = json.loads(row["times"])
        except Exception:
            row["times"] = []
    return row


def list_reminders(user_id):
    rows = db_engine.fetchall(
        "SELECT * FROM medication_reminders WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    )
    for r in rows:
        if isinstance(r.get("times"), str):
            try:
                r["times"] = json.loads(r["times"])
            except Exception:
                r["times"] = []
    return rows


def list_reminders_for_patient(patient_id):
    """List all reminders created for a specific patient (by any worker)."""
    rows = db_engine.fetchall(
        "SELECT * FROM medication_reminders WHERE patient_id = ? ORDER BY created_at DESC",
        (patient_id,)
    )
    for r in rows:
        if isinstance(r.get("times"), str):
            try:
                r["times"] = json.loads(r["times"])
            except Exception:
                r["times"] = []
    return rows


def list_reminders_created_by_worker(worker_user_id):
    """List all reminders created by a specific healthcare worker across all patients."""
    rows = db_engine.fetchall(
        "SELECT * FROM medication_reminders WHERE created_by_worker_id = ? ORDER BY created_at DESC",
        (worker_user_id,)
    )
    for r in rows:
        if isinstance(r.get("times"), str):
            try:
                r["times"] = json.loads(r["times"])
            except Exception:
                r["times"] = []
    return rows


def delete_reminder(reminder_id, user_id):
    """Delete a reminder — allows the patient user OR the creating worker to delete."""
    # Allow deletion if the user is the patient owner OR the creating worker
    row = db_engine.fetchone(
        "SELECT * FROM medication_reminders WHERE id = ?",
        (reminder_id,)
    )
    if not row:
        return False
    if row.get("user_id") != user_id and row.get("created_by_worker_id") != user_id:
        return False
    db_engine.execute(
        "DELETE FROM medication_reminders WHERE id = ?",
        (reminder_id,)
    )
    db_engine.execute(
        "DELETE FROM medication_logs WHERE reminder_id = ?",
        (reminder_id,)
    )
    return True


def _generate_dose_logs_for_reminder(reminder_id, user_id, medicine_name, dosage, times_list):
    """Generate log records for today's scheduled times if not already existing."""
    now_local = datetime.now()
    today_str = now_local.strftime("%Y-%m-%d")
    now_iso = now_local.isoformat()

    for time_str in times_list:
        # Construct local ISO timestamp (without Z suffix) for exact local time display
        scheduled_iso = f"{today_str}T{time_str}:00"

        existing = db_engine.fetchone(
            "SELECT * FROM medication_logs WHERE reminder_id = ? AND scheduled_time LIKE ?",
            (reminder_id, f"{today_str}%{time_str}%")
        )

        if not existing:
            log_id = uuid.uuid4().hex[:12]
            db_engine.execute(
                """
                INSERT INTO medication_logs
                    (id, reminder_id, user_id, medicine_name, dosage,
                     scheduled_time, status, notified_patient, notified_caregiver, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 0, 0, ?)
                """,
                (log_id, reminder_id, user_id, medicine_name, dosage or "", scheduled_iso, now_iso)
            )


def get_today_logs(user_id):
    """Get all dose logs scheduled for today for the user."""
    today_prefix = datetime.now().strftime("%Y-%m-%d")
    rows = db_engine.fetchall(
        """
        SELECT * FROM medication_logs
        WHERE user_id = ? AND scheduled_time LIKE ?
        ORDER BY scheduled_time ASC
        """,
        (user_id, f"{today_prefix}%")
    )
    return rows


def mark_log_taken(log_id, user_id):
    """Mark a dose as taken."""
    now_iso = datetime.now().isoformat()
    db_engine.execute(
        """
        UPDATE medication_logs
        SET status = 'taken', action_time = ?
        WHERE id = ? AND user_id = ?
        """,
        (now_iso, log_id, user_id)
    )
    return db_engine.fetchone("SELECT * FROM medication_logs WHERE id = ?", (log_id,))


def snooze_log(log_id, user_id, minutes=15):
    """Snooze a dose by shifting scheduled_time forward by X minutes."""
    log = db_engine.fetchone("SELECT * FROM medication_logs WHERE id = ? AND user_id = ?", (log_id, user_id))
    if not log:
        return None

    try:
        sched_str = log["scheduled_time"].replace("Z", "")
        sched_dt = datetime.fromisoformat(sched_str)
        new_dt = sched_dt + timedelta(minutes=minutes)
        new_iso = new_dt.isoformat()
        db_engine.execute(
            """
            UPDATE medication_logs
            SET scheduled_time = ?, status = 'snoozed', notified_patient = 0
            WHERE id = ?
            """,
            (new_iso, log_id)
        )
        return db_engine.fetchone("SELECT * FROM medication_logs WHERE id = ?", (log_id,))
    except Exception as e:
        print(f"[reminder_service] Snooze error: {e}")
        return None


# ---------------------------------------------------------------------------
# Background Daemon Engine
# ---------------------------------------------------------------------------

def _run_reminder_daemon_tick():
    """
    Single tick of the background daemon:
    1. Pre-generate today's dose logs for active reminders.
    2. Dispatch patient SMS reminders for due doses.
    3. Identify missed doses (>15 min overdue) and dispatch Caregiver alerts.
    """
    now_local = datetime.now()
    today_str = now_local.strftime("%Y-%m-%d")

    # 1. Pre-generate logs for active reminders
    active_reminders = db_engine.fetchall("SELECT * FROM medication_reminders WHERE status = 'active'")
    for rem in active_reminders:
        times = rem.get("times", "[]")
        if isinstance(times, str):
            try:
                times = json.loads(times)
            except Exception:
                times = []
        _generate_dose_logs_for_reminder(
            rem["id"], rem["user_id"], rem["medicine_name"], rem.get("dosage", ""), times
        )

    # 2. Check scheduled doses and send Patient SMS
    pending_logs = db_engine.fetchall(
        "SELECT * FROM medication_logs WHERE status IN ('scheduled', 'snoozed') AND notified_patient = 0"
    )

    for log in pending_logs:
        try:
            sched_str = log["scheduled_time"].replace("Z", "")
            sched_dt = datetime.fromisoformat(sched_str)

            # Send SMS if due within 2 minutes or overdue
            if now_local >= sched_dt - timedelta(minutes=2):
                rem = db_engine.fetchone("SELECT * FROM medication_reminders WHERE id = ?", (log["reminder_id"],))
                patient_phone = rem.get("patient_phone") if rem else None
                time_fmt = sched_dt.strftime("%I:%M %p")

                send_patient_reminder(log["medicine_name"], log.get("dosage", ""), time_fmt, patient_phone)

                # Create in-app notification for patient
                dosage_text = f" ({log.get('dosage')})" if log.get('dosage') else ""
                create_in_app_notification(
                    user_id=log["user_id"],
                    title=f"💊 Medication Reminder: {log['medicine_name']}",
                    message=f"It's time to take your dose of {log['medicine_name']}{dosage_text} scheduled for {time_fmt}.",
                    notif_type="medication",
                    related_id=log["id"]
                )

                db_engine.execute(
                    "UPDATE medication_logs SET notified_patient = 1 WHERE id = ?", (log["id"],)
                )
        except Exception as e:
            print(f"[daemon] Patient notification error: {e}")

    # 3. Check for missed doses (>15 minutes past due) & send Caregiver alerts
    overdue_logs = db_engine.fetchall(
        "SELECT * FROM medication_logs WHERE status IN ('scheduled', 'snoozed')"
    )

    for log in overdue_logs:
        try:
            sched_str = log["scheduled_time"].replace("Z", "")
            sched_dt = datetime.fromisoformat(sched_str)

            # If overdue past grace period (15 mins)
            if now_local > sched_dt + timedelta(minutes=MISSED_GRACE_MINUTES):
                db_engine.execute(
                    "UPDATE medication_logs SET status = 'missed' WHERE id = ?", (log["id"],)
                )

                dosage_text = f" ({log.get('dosage')})" if log.get('dosage') else ""
                time_fmt = sched_dt.strftime("%I:%M %p")

                # Create in-app missed dose notification for patient
                create_in_app_notification(
                    user_id=log["user_id"],
                    title=f"⚠️ Missed Dose Alert: {log['medicine_name']}",
                    message=f"You missed your scheduled dose of {log['medicine_name']}{dosage_text} at {time_fmt}. Caregiver alert dispatched.",
                    notif_type="missed",
                    related_id=log["id"]
                )

                # Send Caregiver Alert if caregiver phone provided and not notified yet
                if log.get("notified_caregiver", 0) == 0:
                    rem = db_engine.fetchone("SELECT * FROM medication_reminders WHERE id = ?", (log["reminder_id"],))
                    if rem and rem.get("caregiver_phone"):
                        user_row = db_engine.fetchone("SELECT name FROM users WHERE id = ?", (log["user_id"],))
                        patient_name = user_row.get("name", "Patient") if user_row else "Patient"

                        send_caregiver_alert(
                            medicine_name=log["medicine_name"],
                            dosage=log.get("dosage", ""),
                            scheduled_time_str=time_fmt,
                            patient_name=patient_name,
                            caregiver_name=rem.get("caregiver_name", "Caregiver"),
                            caregiver_phone=rem.get("caregiver_phone", "")
                        )

                    db_engine.execute(
                        "UPDATE medication_logs SET notified_caregiver = 1 WHERE id = ?", (log["id"],)
                    )
        except Exception as e:
            print(f"[daemon] Caregiver alert error: {e}")


def _daemon_loop():
    print("[reminder_service] Medication Reminder & Caregiver Alert daemon started.")
    while True:
        try:
            _run_reminder_daemon_tick()
        except Exception as e:
            print(f"[reminder_service] Daemon tick error: {e}")
        time.sleep(30)


_daemon_thread = None


def start_reminder_daemon():
    global _daemon_thread
    if _daemon_thread is None or not _daemon_thread.is_alive():
        _daemon_thread = threading.Thread(target=_daemon_loop, daemon=True)
        _daemon_thread.start()
