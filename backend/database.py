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
            phone         TEXT    UNIQUE DEFAULT NULL,
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

        CREATE TABLE IF NOT EXISTS achievements (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            achievement_id TEXT NOT NULL,
            unlocked_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_id, achievement_id)
        );
        CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
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
    if 'phone' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN phone TEXT UNIQUE DEFAULT NULL")
    if 'xp' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0")
    if 'level' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1")
    if 'streak_days' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN streak_days INTEGER NOT NULL DEFAULT 0")
    if 'last_attempt_date' not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN last_attempt_date TEXT DEFAULT NULL")

    attempt_cols = {row[1] for row in conn.execute("PRAGMA table_info(attempts)").fetchall()}
    if 'stars_earned' not in attempt_cols:
        conn.execute("ALTER TABLE attempts ADD COLUMN stars_earned INTEGER NOT NULL DEFAULT 0")
    if 'xp_earned' not in attempt_cols:
        conn.execute("ALTER TABLE attempts ADD COLUMN xp_earned INTEGER NOT NULL DEFAULT 0")

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
    phone: str = None,
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
           (name, role, email, phone, password_hash, pin_code, pin_hash, parent_id, therapist_id, created_by, age)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, role, email, phone, password_hash, pin_code, pin_hash, parent_id, therapist_id, created_by, age)
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


def get_user_by_phone(phone: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
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


# ─── Gamification helpers ────────────────────────

LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1000, 1400, 1900, 2500, 3200]


def xp_to_level(xp: int) -> int:
    for i in range(len(LEVEL_THRESHOLDS) - 1, -1, -1):
        if xp >= LEVEL_THRESHOLDS[i]:
            return i + 1
    return 1


def stars_and_xp(accuracy: float) -> tuple:
    if accuracy >= 90: return 3, 30
    if accuracy >= 70: return 2, 20
    if accuracy >= 40: return 1, 10
    return 0, 5


ACHIEVEMENTS_DEF = [
    {"id": "first_step",    "emoji": "👶", "title": "Первый шаг",       "desc": "Сделай первую попытку",               "xp_bonus": 20},
    {"id": "perfect",       "emoji": "🎯", "title": "Идеально!",        "desc": "Получи 100% точности",                "xp_bonus": 50},
    {"id": "three_stars",   "emoji": "🌟", "title": "Три звезды",       "desc": "3 звезды за одну попытку",            "xp_bonus": 30},
    {"id": "streak_3",      "emoji": "🔥", "title": "На огне!",         "desc": "3 дня подряд",                        "xp_bonus": 50},
    {"id": "streak_7",      "emoji": "🏆", "title": "Чемпион недели",   "desc": "7 дней подряд",                       "xp_bonus": 100},
    {"id": "attempts_10",   "emoji": "💪", "title": "Настойчивый",      "desc": "10 попыток",                          "xp_bonus": 30},
    {"id": "attempts_50",   "emoji": "🎓", "title": "Тренер",           "desc": "50 попыток",                          "xp_bonus": 100},
    {"id": "sound_master",  "emoji": "🎤", "title": "Мастер звука",     "desc": "5 попыток на звуке с точн.>80%",      "xp_bonus": 50},
    {"id": "level_5",       "emoji": "⭐", "title": "Профи",            "desc": "Достигни 5 уровня",                   "xp_bonus": 100},
    {"id": "accuracy_king", "emoji": "👑", "title": "Король точности",  "desc": "Средняя точность >80% (мин.5 попыток)","xp_bonus": 50},
]


def get_user_achievements(user_id: int) -> list:
    conn = get_connection()
    rows = conn.execute("SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    unlocked = {r['achievement_id']: r['unlocked_at'] for r in rows}
    result = []
    for a in ACHIEVEMENTS_DEF:
        result.append({**a, "unlocked": a['id'] in unlocked, "unlocked_at": unlocked.get(a['id'])})
    return result


def award_xp_and_check_achievements(user_id: int, stars: int, xp_gained: int, accuracy: float, attempt_total: int, streak: int, sound: str, conn) -> dict:
    """Award XP, update level, check/unlock achievements. Returns dict with gamification info."""
    user_row = conn.execute("SELECT xp, level FROM users WHERE id = ?", (user_id,)).fetchone()
    old_xp = user_row['xp']
    old_level = user_row['level']

    existing = {r['achievement_id'] for r in conn.execute("SELECT achievement_id FROM achievements WHERE user_id = ?", (user_id,)).fetchall()}

    sp = conn.execute("SELECT accuracy, attempts_count FROM sound_progress WHERE user_id = ? AND sound = ?", (user_id, sound)).fetchone()
    sound_master_ok = sp and sp['attempts_count'] >= 5 and sp['accuracy'] >= 80

    checks = {
        "first_step":    attempt_total == 1,
        "perfect":       accuracy >= 99.9,
        "three_stars":   stars == 3,
        "streak_3":      streak >= 3,
        "streak_7":      streak >= 7,
        "attempts_10":   attempt_total >= 10,
        "attempts_50":   attempt_total >= 50,
        "sound_master":  bool(sound_master_ok),
        "accuracy_king": False,
    }

    if attempt_total >= 5:
        avg_row = conn.execute("SELECT AVG(accuracy) as avg FROM attempts WHERE user_id = ?", (user_id,)).fetchone()
        checks["accuracy_king"] = avg_row and (avg_row['avg'] or 0) >= 80

    bonus_xp = 0
    to_unlock = []
    for ach in ACHIEVEMENTS_DEF:
        if ach['id'] == 'level_5':
            continue  # checked after XP is awarded
        if ach['id'] not in existing and checks.get(ach['id'], False):
            conn.execute("INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)", (user_id, ach['id']))
            bonus_xp += ach['xp_bonus']
            to_unlock.append(ach)

    new_xp = old_xp + xp_gained + bonus_xp

    new_level_check = xp_to_level(new_xp)
    if new_level_check >= 5 and "level_5" not in existing and not any(a['id'] == 'level_5' for a in to_unlock):
        ach = next(a for a in ACHIEVEMENTS_DEF if a['id'] == 'level_5')
        conn.execute("INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)", (user_id, ach['id']))
        new_xp += ach['xp_bonus']
        to_unlock.append(ach)

    new_level = xp_to_level(new_xp)
    conn.execute("UPDATE users SET xp = ?, level = ? WHERE id = ?", (new_xp, new_level, user_id))

    return {
        "new_xp": new_xp,
        "new_level": new_level,
        "level_up": new_level > old_level,
        "old_level": old_level,
        "unlocked_achievements": to_unlock,
        "bonus_xp": bonus_xp,
    }


def update_streak(user_id: int, conn) -> int:
    """Update daily streak. Returns new streak count."""
    from datetime import date, timedelta
    today = str(date.today())
    row = conn.execute("SELECT streak_days, last_attempt_date FROM users WHERE id = ?", (user_id,)).fetchone()
    last = row['last_attempt_date']
    streak = row['streak_days'] or 0

    if last == today:
        return streak  # already counted today

    yesterday = str(date.today() - timedelta(days=1))
    if last == yesterday:
        streak += 1
    else:
        streak = 1  # reset streak

    conn.execute("UPDATE users SET streak_days = ?, last_attempt_date = ? WHERE id = ?", (streak, today, user_id))
    return streak


def get_child_gamification(user_id: int) -> dict:
    conn = get_connection()
    row = conn.execute("SELECT xp, level, streak_days, last_attempt_date FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        conn.close()
        return {}
    xp = row['xp']
    level = row['level']
    streak = row['streak_days'] or 0

    thresholds = LEVEL_THRESHOLDS
    level_idx = level - 1
    xp_current_level = thresholds[level_idx] if level_idx < len(thresholds) else thresholds[-1]
    xp_next_level = thresholds[level_idx + 1] if level_idx + 1 < len(thresholds) else None

    stars_row = conn.execute("SELECT COALESCE(SUM(stars_earned), 0) as total FROM attempts WHERE user_id = ?", (user_id,)).fetchone()
    total_stars = stars_row['total'] if stars_row else 0

    achievements = get_user_achievements(user_id)
    conn.close()

    return {
        "xp": xp,
        "level": level,
        "streak_days": streak,
        "total_stars": total_stars,
        "xp_current_level": xp_current_level,
        "xp_next_level": xp_next_level,
        "achievements": achievements,
    }


# ─── Attempt helpers ─────────────────────────────

def create_attempt(user_id: int, target_word: str, transcription: str,
                   detected_errors: list, accuracy: float,
                   duration_ms: int = None, audio_path: str = None,
                   sound: str = None) -> dict:
    import json as _json
    stars, xp = stars_and_xp(accuracy)
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """INSERT INTO attempts (user_id, target_word, transcription, detected_errors, accuracy, duration_ms, audio_path, stars_earned, xp_earned)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (user_id, target_word, transcription, _json.dumps(detected_errors), accuracy, duration_ms, audio_path, stars, xp)
    )
    attempt_id = cursor.lastrowid

    sound_key = sound or (target_word[0].upper() if target_word else "?")
    existing = conn.execute(
        "SELECT * FROM sound_progress WHERE user_id = ? AND sound = ?", (user_id, sound_key)
    ).fetchone()
    if existing:
        new_count = existing["attempts_count"] + 1
        new_avg = (existing["accuracy"] * existing["attempts_count"] + accuracy) / new_count
        conn.execute(
            "UPDATE sound_progress SET accuracy=?, attempts_count=?, last_practiced=datetime('now') WHERE user_id=? AND sound=?",
            (round(new_avg, 1), new_count, user_id, sound_key)
        )
    else:
        conn.execute(
            "INSERT INTO sound_progress (user_id, sound, accuracy, attempts_count, last_practiced) VALUES (?,?,?,1,datetime('now'))",
            (user_id, sound_key, accuracy)
        )

    streak = update_streak(user_id, conn)
    total = conn.execute("SELECT COUNT(*) as cnt FROM attempts WHERE user_id = ?", (user_id,)).fetchone()['cnt']
    gamification = award_xp_and_check_achievements(user_id, stars, xp, accuracy, total, streak, sound_key, conn)
    gamification['stars_earned'] = stars
    gamification['xp_earned'] = xp + gamification.get('bonus_xp', 0)
    gamification['streak'] = streak

    conn.commit()
    attempt = dict(conn.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,)).fetchone())
    conn.close()
    attempt['gamification'] = gamification
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