"""
Kazakh Speech Therapy API - Main Application
"""
import os
import json
import time
import hmac
import hashlib
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydub import AudioSegment
import torch
from transformers import pipeline

from database import (
    create_user, get_user, get_user_by_pin, get_all_users,
    create_attempt, get_user_attempts, get_user_stats,
    get_therapist_patients, get_problem_sounds
)

SECRET_KEY = os.getenv('SECRET_KEY', 'change_this_secret')
TOKEN_EXPIRE_SECONDS = int(os.getenv('TOKEN_EXPIRE_SECONDS', '86400'))


def create_token(user_id: int, expires_in: int = TOKEN_EXPIRE_SECONDS) -> str:
    payload = json.dumps({
        'user_id': user_id,
        'exp': int(time.time()) + expires_in,
    }, separators=(',', ':')).encode('utf-8')
    encoded = base64.urlsafe_b64encode(payload).decode('utf-8').rstrip('=')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), encoded.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def verify_token(token: str) -> int | None:
    try:
        encoded, signature = token.rsplit('.', 1)
        expected = hmac.new(SECRET_KEY.encode('utf-8'), encoded.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return None
        payload_bytes = base64.urlsafe_b64decode(encoded + '=' * ((4 - len(encoded) % 4) % 4))
        payload = json.loads(payload_bytes)
        if int(time.time()) > payload.get('exp', 0):
            return None
        return int(payload['user_id'])
    except Exception:
        return None


def get_current_user(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Unauthorized')
    token = authorization.split(' ', 1)[1]
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user


app = FastAPI(title="Kazakh Speech Therapy API", version="1.0.0")

# Setup CORS for mobile and web app connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

# Load ASR model
print("Загрузка ИИ-модели (ASR)... Это может занять пару минут при первом запуске.")
asr_pipeline = None
try:
    asr_pipeline = pipeline(
        task="automatic-speech-recognition", 
        model="openai/whisper-tiny",
        device=0 if torch.cuda.is_available() else -1
    )
    print("✅ ИИ-модель успешно загружена.")
except Exception as e:
    print(f"❌ Ошибка загрузки ИИ-модели: {e}")


# ──────────────────────────────────────────────
#  SEED DEMO DATA (for MVP)
# ──────────────────────────────────────────────
def seed_demo_data():
    """Create demo users if DB is empty."""
    existing = get_all_users()
    if existing:
        return

    print("🌱 Создание демо-пользователей...")
    # Create therapist
    therapist = create_user(name="Айгуль", role="therapist", email="aigul@logoped.kz")
    
    # Create parent
    parent = create_user(name="Анар", role="parent", pin_code="1111")
    
    # Create children
    amina = create_user(name="Амина", role="child", pin_code="1234", 
                        parent_id=parent["id"], therapist_id=therapist["id"], age=5)
    timur = create_user(name="Тимур", role="child", pin_code="5678", 
                        parent_id=parent["id"], therapist_id=therapist["id"], age=6)
    aisha = create_user(name="Айша", role="child", pin_code="9012", 
                        therapist_id=therapist["id"], age=4)
    
    print(f"✅ Создано {len(existing) + 3} пользователей")
    
    # Seed some demo attempts for Amina
    demo_attempts = [
        (amina["id"], "Рама", "рама", [], 95.0, 3000),
        (amina["id"], "Рама", "лама", ["Замена звука Р на Л (Ротацизм)"], 30.0, 2500),
        (amina["id"], "Қала", "қала", [], 100.0, 2000),
        (amina["id"], "Рама", "лама", ["Замена звука Р на Л (Ротацизм)"], 25.0, 2800),
        (amina["id"], "Лампа", "лампа", [], 90.0, 2200),
        (amina["id"], "Рама", "рама", [], 100.0, 3100),
    ]
    for uid, word, trans, errors, acc, dur in demo_attempts:
        create_attempt(uid, word, trans, errors, acc, dur)
    print(f"✅ Добавлено {len(demo_attempts)} демо-попыток")


seed_demo_data()


# ──────────────────────────────────────────────
#  HELPER: Compute accuracy based on transcription
# ──────────────────────────────────────────────
def compute_accuracy(transcription: str, target_word: str) -> tuple[float, list[str]]:
    """
    Simple accuracy computation for MVP.
    Returns (accuracy_percent, detected_errors).
    """
    target_lower = target_word.lower().strip()
    trans_lower = transcription.lower().strip()
    errors = []

    if not trans_lower:
        return 0.0, ["Речь не распознана"]

    # Exact match = 100%
    if trans_lower == target_lower:
        return 100.0, []

    # Character-level comparison
    max_len = max(len(target_lower), len(trans_lower))
    if max_len == 0:
        return 100.0, []

    matching = sum(1 for a, b in zip(target_lower, trans_lower) if a == b)
    accuracy = round((matching / max_len) * 100, 1)

    # Check for specific speech therapy errors
    if target_lower == "рама":
        if "л" in trans_lower and "р" in trans_lower:
            pass  # might have both - let char match decide
        elif "л" in trans_lower:
            errors.append("Замена звука Р на Л (Ротацизм)")
        elif len(trans_lower) < 3:
            errors.append("Слово произнесено неполностью")
    elif target_lower == "лампа":
        if "р" in trans_lower and "л" in trans_lower:
            pass
        elif "р" in trans_lower:
            errors.append("Замена звука Л на Р")
        elif len(trans_lower) < 4:
            errors.append("Слово произнесено неполностью")
    elif target_lower == "қала":
        if "к" in trans_lower or "қ" not in trans_lower:
            errors.append("Звук Қ произнесён как К")
        elif len(trans_lower) < 3:
            errors.append("Слово произнесено неполностью")

    # If accuracy is decent but no match, add general note
    if accuracy >= 50 and not errors:
        errors.append("Небольшие искажения произношения")

    return accuracy, errors


# ──────────────────────────────────────────────
#  HEALTH / ROOT
# ──────────────────────────────────────────────
@app.get("/")
def read_root():
    users_count = len(get_all_users())
    attempts_count = sum(len(get_user_attempts(u["id"], limit=9999)) for u in get_all_users())
    return {
        "message": "Kazakh Speech Therapy AI Backend",
        "version": "1.0.0",
        "stats": {
            "users": users_count,
            "total_attempts": attempts_count,
            "model_loaded": asr_pipeline is not None
        }
    }


# ──────────────────────────────────────────────
#  USER ENDPOINTS
# ──────────────────────────────────────────────
@app.post("/users/")
def api_create_user(
    name: str = Form(...),
    role: str = Form(...),
    pin_code: str = Form(None),
    email: str = Form(None),
    parent_id: int = Form(None),
    therapist_id: int = Form(None),
    age: int = Form(None)
):
    if role not in ("child", "parent", "therapist"):
        raise HTTPException(400, "Role must be 'child', 'parent', or 'therapist'")
    user = create_user(name, role, pin_code, email, parent_id, therapist_id, age)
    return {"status": "success", "user": user}


@app.post("/auth/pin/")
def api_auth_by_pin(pin_code: str = Form(...)):
    user = get_user_by_pin(pin_code)
    if not user:
        raise HTTPException(404, "Пользователь с таким PIN не найден")
    token = create_token(user["id"])
    return {"status": "success", "user": user, "access_token": token, "token_type": "bearer"}


@app.get("/auth/me/")
def api_auth_me(current_user: dict = Depends(get_current_user)):
    return {"status": "success", "user": current_user}


@app.get("/users/")
def api_list_users(role: str = None):
    users = get_all_users(role)
    return {"users": users}


@app.get("/users/{user_id}/")
def api_get_user(user_id: int):
    user = get_user(user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return {"user": user}


@app.get("/users/{user_id}/stats/")
def api_user_stats(user_id: int):
    user = get_user(user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    stats = get_user_stats(user_id)
    problem_sounds = get_problem_sounds(user_id)
    stats["problem_sounds"] = problem_sounds
    return {"stats": stats}


@app.get("/users/{user_id}/attempts/")
def api_user_attempts(user_id: int, limit: int = 20):
    user = get_user(user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    attempts = get_user_attempts(user_id, limit)
    return {"attempts": attempts}


@app.get("/users/{user_id}/problem-sounds/")
def api_problem_sounds(user_id: int):
    user = get_user(user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    sounds = get_problem_sounds(user_id)
    return {"problem_sounds": sounds}


# ──────────────────────────────────────────────
#  THERAPIST ENDPOINTS
# ──────────────────────────────────────────────
@app.get("/therapist/{therapist_id}/patients/")
def api_therapist_patients(therapist_id: int):
    therapist = get_user(therapist_id)
    if not therapist or therapist["role"] != "therapist":
        raise HTTPException(404, "Логопед не найден")
    patients = get_therapist_patients(therapist_id)
    return {"patients": patients}


# ──────────────────────────────────────────────
#  AUDIO ANALYSIS
# ──────────────────────────────────────────────
@app.post("/analyze-audio/")
async def analyze_audio(
    file: UploadFile = File(...),
    target_word: str = Form("рама"),
    user_id: int = Form(None)
):
    """
    Analyze audio recording for speech therapy.
    Saves attempt to database if user_id is provided.
    """
    # 1. Save upload
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else "webm"
    original_path = f"uploads/temp_upload.{file_extension}"
    
    with open(original_path, "wb") as f:
        f.write(await file.read())
    
    try:
        # 2. Convert to 16kHz mono WAV
        start_time = time.time()
        audio = AudioSegment.from_file(original_path)
        duration_ms = len(audio)
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        wav_path = "uploads/processed_audio.wav"
        audio.export(wav_path, format="wav")
        
        # 3. Run ASR inference
        transcription = ""
        if asr_pipeline is not None:
            result = asr_pipeline(wav_path, generate_kwargs={"language": "kazakh"})
            transcription = result.get('text', '').strip()
        
        processing_time = round((time.time() - start_time) * 1000)
        
        # 4. Compute accuracy and detect errors
        accuracy, detected_errors = compute_accuracy(transcription, target_word)
        
        # 5. Save to database if user_id provided
        attempt_record = None
        if user_id:
            attempt_record = create_attempt(
                user_id=user_id,
                target_word=target_word,
                transcription=transcription,
                detected_errors=detected_errors,
                accuracy=accuracy,
                duration_ms=int(duration_ms),
                audio_path=wav_path
            )
        
        # 6. Build response message
        if accuracy >= 90:
            message = f"Отличное произношение! Ошибок нет."
        elif accuracy >= 70:
            message = f"Хорошо, но есть небольшие недочеты."
        elif accuracy >= 40:
            message = f"Слово произнесено с искажениями."
        else:
            message = f"Попробуй еще раз, произнеси слово четче."
        
        if detected_errors:
            message += f" Обнаружено: {', '.join(detected_errors)}."
        
        response = {
            "status": "success",
            "message": message,
            "transcription": transcription,
            "target_word": target_word,
            "accuracy": accuracy,
            "detected_errors": detected_errors,
            "processing_time_ms": processing_time,
        }
        
        if attempt_record:
            response["attempt_id"] = attempt_record["id"]
        
        return response
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Произошла ошибка при обработке: {str(e)}"}
        )
    finally:
        # Clean up temp file
        if os.path.exists(original_path):
            os.remove(original_path)


# ──────────────────────────────────────────────
#  RUN
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)