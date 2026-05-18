"""
Kazakh Speech Therapy API — Main Application
Roles: superadmin > admin > therapist | parent | child
"""
import os
import json
import time
import hmac
import hashlib
import base64
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydub import AudioSegment
import torch
from transformers import pipeline

from phoneme_analyzer import analyze_pronunciation
from database import (
    create_user, get_user, get_user_by_email, get_user_by_phone, get_user_by_pin,
    get_all_users, get_children_of_parent, update_user, delete_user,
    create_attempt, get_user_attempts, get_user_stats,
    get_therapist_patients, get_problem_sounds, get_global_stats,
    hash_password, hash_pin,
    create_plan, get_plan, get_plans_for_child, get_active_plan,
    get_plans_by_therapist, update_plan_status, delete_plan,
    get_child_gamification, get_user_achievements, ACHIEVEMENTS_DEF,
)

SECRET_KEY = os.getenv('SECRET_KEY', 'change_this_secret_in_prod')
TOKEN_EXPIRE_SECONDS = int(os.getenv('TOKEN_EXPIRE_SECONDS', '86400'))

# ── Role hierarchy ─────────────────────────────
ROLE_LEVELS = {'superadmin': 4, 'admin': 3, 'therapist': 2, 'parent': 1, 'child': 0}

def can_manage(actor_role: str, target_role: str) -> bool:
    """Actor can create/delete users with lower or equal level (except own superadmin)."""
    return ROLE_LEVELS.get(actor_role, -1) > ROLE_LEVELS.get(target_role, 99)


# ── Token helpers ──────────────────────────────
def create_token(user_id: int, expires_in: int = TOKEN_EXPIRE_SECONDS) -> str:
    payload = json.dumps({'user_id': user_id, 'exp': int(time.time()) + expires_in},
                         separators=(',', ':')).encode()
    encoded = base64.urlsafe_b64encode(payload).decode().rstrip('=')
    sig = hmac.new(SECRET_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{sig}"


def verify_token(token: str) -> int | None:
    try:
        encoded, sig = token.rsplit('.', 1)
        expected = hmac.new(SECRET_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(encoded + '=' * ((4 - len(encoded) % 4) % 4)))
        if int(time.time()) > payload.get('exp', 0):
            return None
        return int(payload['user_id'])
    except Exception:
        return None


def get_current_user(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Unauthorized')
    user_id = verify_token(authorization.split(' ', 1)[1])
    if not user_id:
        raise HTTPException(401, 'Invalid or expired token')
    user = get_user(user_id)
    if not user:
        raise HTTPException(401, 'User not found')
    return user


def require_roles(*roles: str):
    def dep(current_user: dict = Depends(get_current_user)):
        if current_user['role'] not in roles:
            raise HTTPException(403, f"Access denied. Required roles: {roles}")
        return current_user
    return dep


# ── App ────────────────────────────────────────
app = FastAPI(title="Kazakh Speech Therapy API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

# Load ASR model
print("Загрузка ИИ-модели (ASR)...")
asr_pipeline = None
try:
    asr_pipeline = pipeline(
        task="automatic-speech-recognition", model="openai/whisper-tiny",
        device=0 if torch.cuda.is_available() else -1
    )
    print("✅ ИИ-модель загружена.")
except Exception as e:
    print(f"❌ Ошибка загрузки ИИ-модели: {e}")


# ── Seed ──────────────────────────────────────
def seed_demo_data():
    existing = get_all_users()
    if existing:
        return
    print("🌱 Создание демо-данных...")

    superadmin = create_user(name="Суперадмин", role="superadmin",
                             phone="+77000000001", email="superadmin@logoped.kz", password="admin123")
    admin = create_user(name="Админ Асель", role="admin",
                        phone="+77000000002", email="admin@logoped.kz", password="admin123",
                        created_by=superadmin["id"])
    therapist = create_user(name="Логопед Айгуль", role="therapist",
                            phone="+77000000003", email="aigul@logoped.kz", password="therapist123",
                            created_by=admin["id"])
    parent = create_user(name="Родитель Анар", role="parent",
                         phone="+77000000004", email="anar@example.kz", password="parent123",
                         created_by=admin["id"])
    amina = create_user(name="Амина", role="child",
                        phone="+77000000005", password="child123",
                        parent_id=parent["id"], therapist_id=therapist["id"],
                        age=5, created_by=parent["id"])
    timur = create_user(name="Тимур", role="child",
                        phone="+77000000006", password="child456",
                        parent_id=parent["id"], therapist_id=therapist["id"],
                        age=6, created_by=parent["id"])
    create_user(name="Айша", role="child",
                phone="+77000000007", password="child789",
                therapist_id=therapist["id"], age=4, created_by=therapist["id"])

    # Demo attempts
    for word, trans, errors, acc, dur in [
        ("Рама", "рама", [], 95.0, 3000),
        ("Рама", "лама", ["Замена звука Р на Л (Ротацизм)"], 30.0, 2500),
        ("Қала", "қала", [], 100.0, 2000),
        ("Лампа", "лампа", [], 90.0, 2200),
        ("Рама", "рама", [], 100.0, 3100),
    ]:
        create_attempt(amina["id"], word, trans, errors, acc, dur)

    print(f"✅ Демо-данные созданы. Superadmin: +77000000001 / admin123")


seed_demo_data()




# ──────────────────────────────────────────────
#  HEALTH
# ──────────────────────────────────────────────
@app.get("/")
def read_root():
    s = get_global_stats()
    return {"message": "Kazakh Speech Therapy AI", "version": "2.0.0", "stats": s, "model_loaded": asr_pipeline is not None}


# ──────────────────────────────────────────────
#  AUTH
# ──────────────────────────────────────────────
@app.post("/auth/login/")
def api_login(login: str = Form(...), password: str = Form(...)):
    """Phone or email + password login for all roles."""
    # Try phone first, then email
    user = get_user_by_phone(login) or get_user_by_email(login)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    if user.get("password_hash") != hash_password(password):
        raise HTTPException(401, "Неверный пароль")
    if not user.get("is_active", 1):
        raise HTTPException(403, "Аккаунт деактивирован")
    token = create_token(user["id"])
    safe_user = {k: v for k, v in user.items() if k not in ("password_hash", "pin_hash", "pin_code")}
    return {"status": "success", "user": safe_user, "access_token": token, "token_type": "bearer"}


@app.post("/auth/pin/")
def api_auth_by_pin(pin_code: str = Form(...)):
    """PIN login for child accounts (and parent if they use a PIN)."""
    user = get_user_by_pin(pin_code)
    if not user:
        raise HTTPException(404, "Пользователь с таким PIN не найден")
    token = create_token(user["id"])
    return {"status": "success", "user": user, "access_token": token, "token_type": "bearer"}


@app.get("/auth/me/")
def api_auth_me(current_user: dict = Depends(get_current_user)):
    return {"status": "success", "user": current_user}


@app.post("/auth/register/")
def api_register_parent(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
):
    """Self-registration for parents."""
    if len(password) < 6:
        raise HTTPException(400, "Пароль должен содержать минимум 6 символов")
    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(400, "Email уже зарегистрирован")
    user = create_user(name=name, role="parent", email=email, password=password)
    token = create_token(user["id"])
    return {"status": "success", "user": user, "access_token": token, "token_type": "bearer"}


# ──────────────────────────────────────────────
#  USER MANAGEMENT (admin/superadmin)
# ──────────────────────────────────────────────
@app.get("/users/")
def api_list_users(
    role: str = None,
    current_user: dict = Depends(get_current_user)
):
    """List users. Scope depends on role."""
    actor_role = current_user["role"]
    if actor_role in ("superadmin", "admin"):
        users = get_all_users(role=role)
    elif actor_role == "therapist":
        users = get_therapist_patients(current_user["id"])
    elif actor_role == "parent":
        users = get_children_of_parent(current_user["id"])
    else:
        raise HTTPException(403, "Недостаточно прав")
    return {"users": users}


@app.post("/users/")
def api_create_user(
    name: str = Form(...),
    role: str = Form(...),
    phone: str = Form(None),
    email: str = Form(None),
    password: str = Form(None),
    parent_id: int = Form(None),
    therapist_id: int = Form(None),
    age: int = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Create a user. Caller must outrank the new user's role."""
    actor_role = current_user["role"]
    if not can_manage(actor_role, role):
        raise HTTPException(403, f"Роль '{actor_role}' не может создавать '{role}'")

    if not phone and not email:
        raise HTTPException(400, "Номер телефона или email обязателен")
    if not password:
        raise HTTPException(400, "Пароль обязателен")

    if phone and get_user_by_phone(phone):
        raise HTTPException(400, "Номер телефона уже занят")
    if email and get_user_by_email(email):
        raise HTTPException(400, "Email уже занят")

    user = create_user(
        name=name, role=role, phone=phone, email=email, password=password,
        parent_id=parent_id, therapist_id=therapist_id,
        created_by=current_user["id"], age=age,
    )
    return {"status": "success", "user": user}


@app.get("/users/{user_id}/")
def api_get_user(user_id: int, current_user: dict = Depends(get_current_user)):
    user = get_user(user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    # Access check: superadmin/admin always, therapist sees own patients, parent sees own children
    actor = current_user
    if actor["role"] in ("superadmin", "admin"):
        pass
    elif actor["role"] == "therapist" and user.get("therapist_id") == actor["id"]:
        pass
    elif actor["role"] == "parent" and user.get("parent_id") == actor["id"]:
        pass
    elif actor["id"] == user_id:
        pass
    else:
        raise HTTPException(403, "Нет доступа")
    return {"user": user}


@app.patch("/users/{user_id}/")
def api_update_user(
    user_id: int,
    name: str = Form(None),
    email: str = Form(None),
    age: int = Form(None),
    therapist_id: int = Form(None),
    is_active: int = Form(None),
    current_user: dict = Depends(get_current_user),
):
    target = get_user(user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    if not can_manage(current_user["role"], target["role"]) and current_user["id"] != user_id:
        raise HTTPException(403, "Нет прав")
    kwargs = {}
    if name is not None: kwargs["name"] = name
    if email is not None: kwargs["email"] = email
    if age is not None: kwargs["age"] = age
    if therapist_id is not None: kwargs["therapist_id"] = therapist_id
    if is_active is not None: kwargs["is_active"] = is_active
    updated = update_user(user_id, **kwargs)
    return {"status": "success", "user": updated}


@app.delete("/users/{user_id}/")
def api_delete_user(user_id: int, current_user: dict = Depends(get_current_user)):
    target = get_user(user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    if not can_manage(current_user["role"], target["role"]):
        raise HTTPException(403, "Нет прав для удаления")
    delete_user(user_id)
    return {"status": "success", "message": "Пользователь удалён"}


# ──────────────────────────────────────────────
#  STATS / ATTEMPTS
# ──────────────────────────────────────────────
@app.get("/users/{user_id}/stats/")
def api_user_stats(user_id: int, current_user: dict = Depends(get_current_user)):
    user = get_user(user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    stats = get_user_stats(user_id)
    stats["problem_sounds"] = get_problem_sounds(user_id)
    return {"stats": stats}


@app.get("/users/{user_id}/attempts/")
def api_user_attempts(user_id: int, limit: int = 20, current_user: dict = Depends(get_current_user)):
    attempts = get_user_attempts(user_id, limit)
    return {"attempts": attempts}


@app.get("/users/{user_id}/problem-sounds/")
def api_problem_sounds(user_id: int, current_user: dict = Depends(get_current_user)):
    return {"problem_sounds": get_problem_sounds(user_id)}


# ──────────────────────────────────────────────
#  PARENT-specific
# ──────────────────────────────────────────────
@app.get("/parent/{parent_id}/children/")
def api_parent_children(parent_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("superadmin", "admin", "therapist") and current_user["id"] != parent_id:
        raise HTTPException(403, "Нет доступа")
    children = get_children_of_parent(parent_id)
    return {"children": children}


@app.post("/parent/{parent_id}/children/")
def api_add_child(
    parent_id: int,
    name: str = Form(...),
    phone: str = Form(...),
    password: str = Form(...),
    age: int = Form(None),
    therapist_id: int = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Parent adds a child to their account."""
    if current_user["role"] not in ("superadmin", "admin") and current_user["id"] != parent_id:
        raise HTTPException(403, "Нет доступа")
    parent = get_user(parent_id)
    if not parent or parent["role"] != "parent":
        raise HTTPException(404, "Родитель не найден")
    if len(password) < 4:
        raise HTTPException(400, "Пароль должен содержать минимум 4 символа")
    if get_user_by_phone(phone):
        raise HTTPException(400, "Номер телефона уже занят")
    child = create_user(
        name=name, role="child", phone=phone, password=password,
        parent_id=parent_id, therapist_id=therapist_id,
        created_by=current_user["id"], age=age,
    )
    return {"status": "success", "user": child}


# ──────────────────────────────────────────────
#  THERAPIST-specific
# ──────────────────────────────────────────────
@app.get("/therapist/{therapist_id}/patients/")
def api_therapist_patients(therapist_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("superadmin", "admin") and current_user["id"] != therapist_id:
        raise HTTPException(403, "Нет доступа")
    therapist = get_user(therapist_id)
    if not therapist or therapist["role"] != "therapist":
        raise HTTPException(404, "Логопед не найден")
    return {"patients": get_therapist_patients(therapist_id)}


# ──────────────────────────────────────────────
#  AUDIO ANALYSIS
# ──────────────────────────────────────────────
@app.post("/analyze-audio/")
async def analyze_audio(
    file: UploadFile = File(...),
    target_word: str = Form("рама"),
    user_id: int = Form(None),
    sound: str = Form(None),
):
    file_ext = file.filename.split('.')[-1] if file.filename and '.' in file.filename else "webm"
    rid = uuid.uuid4().hex
    orig = f"uploads/upload_{rid}.{file_ext}"
    wav = f"uploads/processed_{rid}.wav"

    with open(orig, "wb") as f:
        f.write(await file.read())

    try:
        t0 = time.time()
        audio = AudioSegment.from_file(orig)
        duration_ms = len(audio)
        audio.set_frame_rate(16000).set_channels(1).export(wav, format="wav")

        transcription = ""
        if asr_pipeline:
            result = asr_pipeline(wav, generate_kwargs={"language": "kazakh"})
            transcription = result.get('text', '').strip()

        processing_ms = round((time.time() - t0) * 1000)

        analysis        = analyze_pronunciation(transcription, target_word)
        accuracy        = analysis['accuracy']
        detected_errors = analysis['detected_errors']
        phoneme_analysis = analysis['phoneme_analysis']

        attempt_record = None
        if user_id:
            attempt_record = create_attempt(
                user_id=user_id, target_word=target_word,
                transcription=transcription, detected_errors=detected_errors,
                accuracy=accuracy, duration_ms=int(duration_ms), audio_path=wav,
                sound=sound,
            )

        severity = phoneme_analysis.get('overall_severity', 'none')
        if accuracy >= 90:
            msg = "Отличное произношение!"
        elif accuracy >= 70:
            msg = "Хорошо, но есть небольшие недочёты."
        elif accuracy >= 40:
            msg = "Слово произнесено с искажениями."
        else:
            msg = "Попробуй ещё раз, произнеси слово чётче."
        if phoneme_analysis['disorders_found']:
            msg += f" Выявлено: {phoneme_analysis['disorders_found'][0]['disorder']}."

        resp = {
            "status": "success", "message": msg,
            "transcription": transcription, "target_word": target_word,
            "accuracy": accuracy, "detected_errors": detected_errors,
            "phoneme_analysis": phoneme_analysis,
            "processing_time_ms": processing_ms,
        }
        if attempt_record:
            resp["attempt_id"] = attempt_record["id"]
            resp["gamification"] = attempt_record.get("gamification", {})
        return resp

    except Exception as e:
        return JSONResponse(500, {"status": "error", "message": str(e)})
    finally:
        for p in (orig, wav):
            try:
                if os.path.exists(p): os.remove(p)
            except OSError:
                pass


# ──────────────────────────────────────────────
#  TREATMENT PLANS
# ──────────────────────────────────────────────

@app.get("/children/{child_id}/plan/")
def api_get_active_plan(child_id: int, current_user: dict = Depends(get_current_user)):
    actor = current_user
    if actor['role'] not in ('superadmin', 'admin', 'therapist') and actor['id'] != child_id:
        child = get_user(child_id)
        if not child or child.get('parent_id') != actor['id']:
            raise HTTPException(403, "Нет доступа")
    plan = get_active_plan(child_id)
    return {"plan": plan}


@app.get("/children/{child_id}/plans/")
def api_get_child_plans(child_id: int, current_user: dict = Depends(get_current_user)):
    actor = current_user
    if actor['role'] not in ('superadmin', 'admin', 'therapist') and actor['id'] != child_id:
        child = get_user(child_id)
        if not child or child.get('parent_id') != actor['id']:
            raise HTTPException(403, "Нет доступа")
    return {"plans": get_plans_for_child(child_id)}


@app.post("/plans/")
def api_create_plan(
    child_id: int = Form(...),
    title: str = Form("Индивидуальный план"),
    description: str = Form(""),
    exercises: str = Form(...),   # JSON string: [{sound, sound_letter, words, target_accuracy, sessions_target}]
    current_user: dict = Depends(get_current_user),
):
    if current_user['role'] not in ('superadmin', 'admin', 'therapist'):
        raise HTTPException(403, "Только логопед может создавать планы")
    child = get_user(child_id)
    if not child or child['role'] != 'child':
        raise HTTPException(404, "Ребёнок не найден")
    try:
        exs = json.loads(exercises)
    except Exception:
        raise HTTPException(400, "Неверный формат exercises (ожидается JSON)")
    plan = create_plan(
        child_id=child_id,
        therapist_id=current_user['id'],
        title=title,
        description=description,
        exercises=exs,
    )
    return {"status": "success", "plan": plan}


@app.get("/plans/{plan_id}/")
def api_get_plan(plan_id: int, current_user: dict = Depends(get_current_user)):
    plan = get_plan(plan_id)
    if not plan:
        raise HTTPException(404, "План не найден")
    return {"plan": plan}


@app.patch("/plans/{plan_id}/status/")
def api_update_plan_status(
    plan_id: int,
    status: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    if current_user['role'] not in ('superadmin', 'admin', 'therapist'):
        raise HTTPException(403, "Нет прав")
    if status not in ('active', 'paused', 'completed'):
        raise HTTPException(400, "Неверный статус")
    plan = update_plan_status(plan_id, status)
    if not plan:
        raise HTTPException(404, "План не найден")
    return {"status": "success", "plan": plan}


@app.delete("/plans/{plan_id}/")
def api_delete_plan(plan_id: int, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ('superadmin', 'admin', 'therapist'):
        raise HTTPException(403, "Нет прав")
    if not delete_plan(plan_id):
        raise HTTPException(404, "План не найден")
    return {"status": "success"}


@app.get("/therapist/{therapist_id}/plans/")
def api_therapist_plans(therapist_id: int, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ('superadmin', 'admin') and current_user['id'] != therapist_id:
        raise HTTPException(403, "Нет доступа")
    return {"plans": get_plans_by_therapist(therapist_id)}


# ──────────────────────────────────────────────
#  GAMIFICATION
# ──────────────────────────────────────────────

@app.get("/children/{child_id}/gamification/")
def api_child_gamification(child_id: int, current_user: dict = Depends(get_current_user)):
    actor = current_user
    if actor['role'] not in ('superadmin', 'admin', 'therapist') and actor['id'] != child_id:
        child = get_user(child_id)
        if not child or child.get('parent_id') != actor['id']:
            raise HTTPException(403, "Нет доступа")
    data = get_child_gamification(child_id)
    if not data:
        raise HTTPException(404, "Пользователь не найден")
    return {"status": "success", **data}


@app.get("/children/{child_id}/achievements/")
def api_child_achievements(child_id: int, current_user: dict = Depends(get_current_user)):
    actor = current_user
    if actor['role'] not in ('superadmin', 'admin', 'therapist') and actor['id'] != child_id:
        child = get_user(child_id)
        if not child or child.get('parent_id') != actor['id']:
            raise HTTPException(403, "Нет доступа")
    achievements = get_user_achievements(child_id)
    return {"status": "success", "achievements": achievements}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
