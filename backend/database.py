"""
Database module for Kazakh Speech Therapy API.
Uses built-in sqlite3 (no SQLAlchemy dependency for MVP).
"""
import sqlite3
import os
import hashlib
from datetime import datetime

DB_URL = os.getenv('DATABASE_URL')
if DB_URL and DB_URL.startswith('sqlite:///'):
    DB_PATH = DB_URL.replace('sqlite:///', '')
elif DB_URL:
    DB_PATH = DB_URL
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), 'speech_therapy.db')


def hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode('utf-8')).hexdigest()


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def ensure_pin_hash_column(conn: sqlite3.Connection):
    columns = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
    if 'pin_hash' not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN pin_hash TEXT DEFAULT NULL;")
    rows = conn.execute("SELECT id, pin_code FROM users WHERE pin_code IS NOT NULL AND (pin_hash IS NULL OR pin_hash = '')").fetchall()
    for row in rows:
        conn.execute("UPDATE users SET pin_hash = ? WHERE id = ?", (hash_pin(row['pin_code']), row['id']))
    conn.commit()


def init_db():
    """Initialize database tables."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('child', 'parent', 'therapist')),
            pin_code TEXT DEFAULT NULL,
            pin_hash TEXT DEFAULT NULL,
            email TEXT DEFAULT NULL,
            parent_id INTEGER DEFAULT NULL REFERENCES users(id),
            therapist_id INTEGER DEFAULT NULL REFERENCES users(id),
            age INTEGER DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            target_word TEXT NOT NULL,
            transcription TEXT NOT NULL DEFAULT '',
            detected_errors TEXT NOT NULL DEFAULT '[]',
            accuracy REAL NOT NULL DEFAULT 0.0,
            duration_ms INTEGER DEFAULT NULL,
            audio_path TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sound_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            sound TEXT NOT NULL,
            accuracy REAL NOT NULL DEFAULT 0.0,
            attempts_count INTEGER NOT NULL DEFAULT 0,
            last_practiced TEXT DEFAULT NULL,
            UNIQUE(user_id, sound)
        );

        CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
        CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);
        CREATE INDEX IF NOT EXISTS idx_sound_progress_user ON sound_progress(user_id);
    """)

    ensure_pin_hash_column(conn)

    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {DB_PATH}")


# --- User helpers ---

def create_user(name: str, role: str, pin_code: str = None, email: str = None,
                parent_id: int = None, therapist_id: int = None, age: int = None) -> dict:
    pin_hash = hash_pin(pin_code) if pin_code else None
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO users (name, role, pin_code, pin_hash, email, parent_id, therapist_id, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, role, pin_code, pin_hash, email, parent_id, therapist_id, age)
    )
    conn.commit()
    user_id = cursor.lastrowid
    user = dict(cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())
    conn.close()
    return user


def get_user(user_id: int) -> dict | None:
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None


def get_user_by_pin(pin_code: str) -> dict | None:
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE pin_hash = ?", (hash_pin(pin_code),)).fetchone()
    if not user:
        user = conn.execute("SELECT * FROM users WHERE pin_code = ?", (pin_code,)).fetchone()
        if user:
            conn.execute("UPDATE users SET pin_hash = ? WHERE id = ?", (hash_pin(pin_code), user['id']))
            conn.commit()
    conn.close()
    return dict(user) if user else None


def get_all_users(role: str = None) -> list[dict]:
    conn = get_connection()
    if role:
        rows = conn.execute("SELECT * FROM users WHERE role = ? ORDER BY name", (role,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM users ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --- Attempt helpers ---

def create_attempt(user_id: int, target_word: str, transcription: str,
                   detected_errors: list, accuracy: float, duration_ms: int = None,
                   audio_path: str = None) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    import json
    cursor.execute(
        """INSERT INTO attempts (user_id, target_word, transcription, detected_errors, accuracy, duration_ms, audio_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user_id, target_word, transcription, json.dumps(detected_errors), accuracy, duration_ms, audio_path)
    )
    conn.commit()
    attempt_id = cursor.lastrowid

    # Update sound_progress
    sound = target_word[0].upper() if target_word else "?"
    existing = cursor.execute(
        "SELECT * FROM sound_progress WHERE user_id = ? AND sound = ?",
        (user_id, sound)
    ).fetchone()

    if existing:
        new_count = existing["attempts_count"] + 1
        new_avg = (existing["accuracy"] * existing["attempts_count"] + accuracy) / new_count
        cursor.execute(
            """UPDATE sound_progress SET accuracy = ?, attempts_count = ?, last_practiced = datetime('now')
               WHERE user_id = ? AND sound = ?""",
            (round(new_avg, 1), new_count, user_id, sound)
        )
    else:
        cursor.execute(
            """INSERT INTO sound_progress (user_id, sound, accuracy, attempts_count, last_practiced)
               VALUES (?, ?, ?, 1, datetime('now'))""",
            (user_id, sound, accuracy)
        )
    conn.commit()

    attempt = dict(cursor.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,)).fetchone())
    conn.close()
    return attempt


def get_user_attempts(user_id: int, limit: int = 20) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT * FROM attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?""",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_user_stats(user_id: int) -> dict:
    conn = get_connection()
    # Basic stats
    stats_row = conn.execute(
        """SELECT COUNT(*) as total_attempts,
                  COALESCE(AVG(accuracy), 0) as avg_accuracy,
                  COALESCE(SUM(duration_ms), 0) as total_duration_ms
           FROM attempts WHERE user_id = ?""",
        (user_id,)
    ).fetchone()

    # Sound progress
    sound_rows = conn.execute(
        "SELECT * FROM sound_progress WHERE user_id = ? ORDER BY accuracy ASC",
        (user_id,)
    ).fetchall()

    # Recent attempts
    recent = conn.execute(
        "SELECT * FROM attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5",
        (user_id,)
    ).fetchall()

    trend_rows = conn.execute(
        """SELECT DATE(created_at) as day,
                  COUNT(*) as attempts,
                  COALESCE(AVG(accuracy), 0) as avg_accuracy
           FROM attempts WHERE user_id = ?
           GROUP BY DATE(created_at)
           ORDER BY day DESC LIMIT 7""",
        (user_id,)
    ).fetchall()

    breakdown_rows = conn.execute(
        """SELECT
                  SUM(CASE WHEN accuracy >= 90 THEN 1 ELSE 0 END) as excellent,
                  SUM(CASE WHEN accuracy >= 70 AND accuracy < 90 THEN 1 ELSE 0 END) as good,
                  SUM(CASE WHEN accuracy < 70 THEN 1 ELSE 0 END) as needs_practice
           FROM attempts WHERE user_id = ?""",
        (user_id,)
    ).fetchone()

    conn.close()

    stats = dict(stats_row)
    stats["sound_progress"] = [dict(r) for r in sound_rows]
    stats["recent_attempts"] = [dict(r) for r in recent]
    stats["attempt_trend"] = [dict(r) for r in reversed(trend_rows)]
    stats["accuracy_breakdown"] = dict(breakdown_rows)
    stats["total_minutes"] = round(stats["total_duration_ms"] / 60000, 1)

    return stats


def get_therapist_patients(therapist_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT u.*, 
                  (SELECT COUNT(*) FROM attempts WHERE user_id = u.id) as total_attempts,
                  (SELECT COALESCE(AVG(accuracy), 0) FROM attempts WHERE user_id = u.id) as avg_accuracy,
                  (SELECT MAX(created_at) FROM attempts WHERE user_id = u.id) as last_active
           FROM users u
           WHERE u.therapist_id = ?
           ORDER BY u.name""",
        (therapist_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_problem_sounds(user_id: int) -> list[str]:
    """Return sounds with accuracy < 70% for a user."""
    conn = get_connection()
    rows = conn.execute(
        """SELECT sound FROM sound_progress WHERE user_id = ? AND accuracy < 70.0 ORDER BY accuracy ASC""",
        (user_id,)
    ).fetchall()
    conn.close()
    return [r["sound"] for r in rows]


# Auto-init when imported
if os.environ.get("SKIP_DB_INIT") != "1":
    init_db()