"""
Database module for Kazakh Speech Therapy API.
Roles: superadmin, admin, therapist, parent, child
"""
import sqlite3
import os
import hashlib
import secrets
from datetime import datetime

DB_URL = os.getenv('DATABASE_URL')
if DB_URL and DB_URL.startswith('sqlite:///'):
    DB_PATH = DB_URL.replace('sqlite:///', '')
elif DB_URL:
    DB_PATH = DB_URL
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), 'speech_therapy.db')

VALID_ROLES = ('superadmin', 'admin', 'therapist', 'parent', 'child')


def hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode('utf-8')).hexdigest()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    """Initialize database tables."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            role          TEXT    NOT NULL CHECK(role IN ('superadmin','admin','therapist','parent','child')),
            email         TEXT    UNIQUE DEFAULT NULL,
            password_hash TEXT    DEFAULT NULL,
            pin_code      TEXT    DEFAULT NULL,
            pin_hash      TEXT    DEFAULT NULL,
            parent_id     INTEGER DEFAULT NULL REFERENCES users(id),
            therapist_id  INTEGER DEFAULT NULL REFERENCES users(id),
            created_by    INTEGER DEFAULT NULL REFERENCES users(id),
            age           INTEGER DEFAULT NULL,
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS attempts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL REFERENCES users(id),
            target_word     TEXT    NOT NULL,
            transcription   TEXT    NOT NULL DEFAULT '',
            detected_errors TEXT    NOT NULL DEFAULT '[]',
            accuracy        REAL    NOT NULL DEFAULT 0.0,
            duration_ms     INTEGER DEFAULT NULL,
            audio_path      TEXT    DEFAULT NULL,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sound_progress (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id        INTEGER NOT NULL REFERENCES users(id),
            sound          TEXT    NOT NULL,
            accuracy       REAL    NOT NULL DEFAULT 0.0,
            attempts_count INTEGER NOT NULL DEFAULT 0,
            last_practiced TEXT    DEFAULT NULL,
            UNIQUE(user_id, sound)
        );

        CREATE INDEX IF NOT EXISTS idx_attempts_user    ON attempts(user_id);
        CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);
        CREATE INDEX IF NOT EXISTS idx_sound_user       ON sound_progress(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_parent     ON users(parent_id);
        CREATE INDEX IF NOT EXISTS idx_users_therapist  ON users(therapist_id);

        CREATE TABLE IF NOT EXISTS treatment_plans (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            therapist_id INTEGER NOT NULL REFERENCES users(id),
            title        TEXT    NOT NULL DEFAULT 'Индивидуальный план',
            description  TEXT    NOT NULL DEFAULT '',
            status       TEXT    NOT NULL DEFAULT 'active'
                             CHECK(status IN ('active','paused','completed')),
            created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS plan_exercises (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id         INTEGER NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
            sound           TEXT    NOT NULL,
            sound_letter    TEXT    NOT NULL,
            words           TEXT    NOT NULL DEFAULT '[]',
            target_accuracy REAL    NOT NULL DEFAULT 80.0,
            order_index     INTEGER NOT NULL DEFAULT 0,
            sessions_target INTEGER NOT NULL DEFAULT 5
        );

        CREATE INDEX IF NOT EXISTS idx_plans_child     ON treatment_plans(child_id);
        CREATE INDEX IF NOT EXISTS idx_plans_therapist ON treatment_plans(therapist_id);
        CREATE INDEX IF NOT EXISTS idx_exercises_plan  ON plan_exercises(plan_id);
    """)

    # Migrations for existing DBs
    _run_migrations(conn)

    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {DB_PATH}")


def _run_migrations(conn: sqlite3.Connection):
    """Apply schema migrations for existing databases."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}

    if 'password_hash' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT NULL")
    if 'created_by' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN created_by INTEGER DEFAULT NULL")
    if 'is_active' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
    if 'pin_hash' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN pin_hash TEXT DEFAULT NULL")

    # Update role CHECK constraint is not directly alterable in SQLite,
    # but existing rows with old roles (child/parent/therapist) remain valid.
    # Migrate pin_code -> pin_hash
    rows = conn.execute(
        "SELECT id, pin_code FROM users WHERE pin_code IS NOT NULL AND (pin_hash IS NULL OR pin_hash = '')"
    ).fetchall()
    for row in rows:
        conn.execute("UPDATE users SET pin_hash = ? WHERE id = ?", (hash_pin(row['pin_code']), row['id']))

    conn.commit()


# ─── User CRUD ───────────────────────────────────

def create_user(
    name: str,
    role: str,
    email: str = None,
    password: str = None,
    pin_code: str = None,
    parent_id: int = None,
    therapist_id: int = None,
    created_by: int = None,
    age: int = None,
) -> dict:
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role: {role}")

    pin_hash = hash_pin(pin_code) if pin_code else None
    password_hash = hash_password(password) if password else None

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO users
           (name, role, email, password_hash, pin_code, pin_hash, parent_id, therapist_id, created_by, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, role, email, password_hash, pin_code, pin_hash, parent_id, therapist_id, created_by, age)
    )
    conn.commit()
    user = dict(cursor.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone())
    conn.close()
    return _sanitize(user)


def get_user(user_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return _sanitize(dict(row)) if row else None


def get_user_by_email(email: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(row) if row else None  # not sanitized — need password_hash for auth


def get_user_by_pin(pin_code: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE pin_hash = ?", (hash_pin(pin_code),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM users WHERE pin_code = ?", (pin_code,)).fetchone()
        if row:
            conn.execute("UPDATE users SET pin_hash = ? WHERE id = ?", (hash_pin(pin_code), row['id']))
            conn.commit()
    conn.close()
    return _sanitize(dict(row)) if row else None


def get_all_users(role: str = None, created_by: int = None) -> list[dict]:
    conn = get_connection()
    where, params = [], []
    if role:
        where.append("role = ?"); params.append(role)
    if created_by is not None:
        where.append("created_by = ?"); params.append(created_by)
    sql = "SELECT * FROM users"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [_sanitize(dict(r)) for r in rows]


def get_children_of_parent(parent_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT u.*,
              (SELECT COUNT(*) FROM attempts WHERE user_id = u.id) as total_attempts,
              (SELECT COALESCE(AVG(accuracy),0) FROM attempts WHERE user_id = u.id) as avg_accuracy,
              (SELECT MAX(created_at) FROM attempts WHERE user_id = u.id) as last_active
           FROM users u WHERE u.parent_id = ? ORDER BY u.name""",
        (parent_id,)
    ).fetchall()
    conn.close()
    return [_sanitize(dict(r)) for r in rows]


def update_user(user_id: int, **kwargs) -> dict | None:
    allowed = {'name', 'email', 'age', 'therapist_id', 'parent_id', 'is_active'}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return get_user(user_id)
    sets = ", ".join(f"{k} = ?" for k in updates)
    conn = get_connection()
    conn.execute(f"UPDATE users SET {sets} WHERE id = ?", (*updates.values(), user_id))
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return _sanitize(dict(row)) if row else None


def delete_user(user_id: int) -> bool:
    conn = get_connection()
    result = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return result.rowcount > 0


def _sanitize(user: dict) -> dict:
    """Remove sensitive fields from user dict."""
    user.pop('password_hash', None)
    return user


# ─── Attempt helpers ─────────────────────────────

def create_attempt(user_id: int, target_word: str, transcription: str,
                   detected_errors: list, accuracy: float,
                   duration_ms: int = None, audio_path: str = None) -> dict:
    import json
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO attempts (user_id, target_word, transcription, detected_errors, accuracy, duration_ms, audio_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user_id, target_word, transcription, json.dumps(detected_errors), accuracy, duration_ms, audio_path)
    )
    conn.commit()
    attempt_id = cursor.lastrowid

    sound = target_word[0].upper() if target_word else "?"
    existing = cursor.execute(
        "SELECT * FROM sound_progress WHERE user_id = ? AND sound = ?", (user_id, sound)
    ).fetchone()
    if existing:
        new_count = existing["attempts_count"] + 1
        new_avg = (existing["accuracy"] * existing["attempts_count"] + accuracy) / new_count
        cursor.execute(
            "UPDATE sound_progress SET accuracy=?, attempts_count=?, last_practiced=datetime('now') WHERE user_id=? AND sound=?",
            (round(new_avg, 1), new_count, user_id, sound)
        )
    else:
        cursor.execute(
            "INSERT INTO sound_progress (user_id, sound, accuracy, attempts_count, last_practiced) VALUES (?,?,?,1,datetime('now'))",
            (user_id, sound, accuracy)
        )
    conn.commit()
    attempt = dict(cursor.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,)).fetchone())
    conn.close()
    return attempt


def get_user_attempts(user_id: int, limit: int = 20) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", (user_id, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_user_stats(user_id: int) -> dict:
    conn = get_connection()
    stats_row = conn.execute(
        """SELECT COUNT(*) as total_attempts,
                  COALESCE(AVG(accuracy),0) as avg_accuracy,
                  COALESCE(SUM(duration_ms),0) as total_duration_ms
           FROM attempts WHERE user_id = ?""", (user_id,)
    ).fetchone()
    sound_rows = conn.execute(
        "SELECT * FROM sound_progress WHERE user_id = ? ORDER BY accuracy ASC", (user_id,)
    ).fetchall()
    recent = conn.execute(
        "SELECT * FROM attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5", (user_id,)
    ).fetchall()
    trend_rows = conn.execute(
        """SELECT DATE(created_at) as day, COUNT(*) as attempts, COALESCE(AVG(accuracy),0) as avg_accuracy
           FROM attempts WHERE user_id = ? GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 7""", (user_id,)
    ).fetchall()
    breakdown_rows = conn.execute(
        """SELECT SUM(CASE WHEN accuracy>=90 THEN 1 ELSE 0 END) as excellent,
                  SUM(CASE WHEN accuracy>=70 AND accuracy<90 THEN 1 ELSE 0 END) as good,
                  SUM(CASE WHEN accuracy<70 THEN 1 ELSE 0 END) as needs_practice
           FROM attempts WHERE user_id = ?""", (user_id,)
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
              (SELECT COALESCE(AVG(accuracy),0) FROM attempts WHERE user_id = u.id) as avg_accuracy,
              (SELECT MAX(created_at) FROM attempts WHERE user_id = u.id) as last_active
           FROM users u WHERE u.therapist_id = ? ORDER BY u.name""", (therapist_id,)
    ).fetchall()
    conn.close()
    return [_sanitize(dict(r)) for r in rows]


def get_problem_sounds(user_id: int) -> list[str]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT sound FROM sound_progress WHERE user_id = ? AND accuracy < 70.0 ORDER BY accuracy ASC", (user_id,)
    ).fetchall()
    conn.close()
    return [r["sound"] for r in rows]


def get_global_stats() -> dict:
    conn = get_connection()
    row = conn.execute(
        """SELECT
               (SELECT COUNT(*) FROM users) AS users_count,
               (SELECT COUNT(*) FROM users WHERE role='child') AS children_count,
               (SELECT COUNT(*) FROM users WHERE role='parent') AS parents_count,
               (SELECT COUNT(*) FROM users WHERE role='therapist') AS therapists_count,
               (SELECT COUNT(*) FROM attempts) AS attempts_count"""
    ).fetchone()
    conn.close()
    return dict(row)


# ─── Treatment Plan CRUD ──────────────────────────────────────────────────────

def _plan_with_exercises(conn, plan_row) -> dict:
    plan = dict(plan_row)
    exs = conn.execute(
        "SELECT * FROM plan_exercises WHERE plan_id = ? ORDER BY order_index", (plan['id'],)
    ).fetchall()
    plan['exercises'] = [dict(e) for e in exs]
    return plan


def create_plan(child_id: int, therapist_id: int, title: str, description: str,
                exercises: list[dict]) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO treatment_plans (child_id, therapist_id, title, description) VALUES (?,?,?,?)",
        (child_id, therapist_id, title, description)
    )
    plan_id = cursor.lastrowid
    for i, ex in enumerate(exercises):
        import json as _json
        cursor.execute(
            """INSERT INTO plan_exercises
               (plan_id, sound, sound_letter, words, target_accuracy, order_index, sessions_target)
               VALUES (?,?,?,?,?,?,?)""",
            (plan_id, ex['sound'], ex['sound_letter'],
             _json.dumps(ex.get('words', [])),
             ex.get('target_accuracy', 80.0), i,
             ex.get('sessions_target', 5))
        )
    conn.commit()
    row = conn.execute("SELECT * FROM treatment_plans WHERE id = ?", (plan_id,)).fetchone()
    result = _plan_with_exercises(conn, row)
    conn.close()
    return result


def get_plans_for_child(child_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM treatment_plans WHERE child_id = ? ORDER BY created_at DESC", (child_id,)
    ).fetchall()
    result = [_plan_with_exercises(conn, r) for r in rows]
    conn.close()
    return result


def get_active_plan(child_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM treatment_plans WHERE child_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        (child_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None
    result = _plan_with_exercises(conn, row)
    conn.close()
    return result


def get_plans_by_therapist(therapist_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT tp.*, u.name AS child_name, u.age AS child_age
           FROM treatment_plans tp
           JOIN users u ON u.id = tp.child_id
           WHERE tp.therapist_id = ?
           ORDER BY tp.created_at DESC""", (therapist_id,)
    ).fetchall()
    result = [_plan_with_exercises(conn, r) for r in rows]
    conn.close()
    return result


def get_plan(plan_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM treatment_plans WHERE id = ?", (plan_id,)).fetchone()
    if not row:
        conn.close()
        return None
    result = _plan_with_exercises(conn, row)
    conn.close()
    return result


def update_plan_status(plan_id: int, status: str) -> dict | None:
    conn = get_connection()
    conn.execute(
        "UPDATE treatment_plans SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (status, plan_id)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM treatment_plans WHERE id = ?", (plan_id,)).fetchone()
    result = _plan_with_exercises(conn, row) if row else None
    conn.close()
    return result


def delete_plan(plan_id: int) -> bool:
    conn = get_connection()
    result = conn.execute("DELETE FROM treatment_plans WHERE id = ?", (plan_id,))
    conn.commit()
    conn.close()
    return result.rowcount > 0


# Auto-init
if os.environ.get("SKIP_DB_INIT") != "1":
    init_db()