import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import torch
from transformers import pipeline

app = FastAPI(title="Kazakh Speech Therapy API")

# Setup CORS for mobile app connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

print("Загрузка ИИ-модели (ASR)... Это может занять пару минут при первом запуске.")
try:
    # Используем Whisper (tiny), так как он поддерживает казахский язык "из коробки" 
    # и доступен публично.
    asr_pipeline = pipeline(
        task="automatic-speech-recognition", 
        model="openai/whisper-tiny",
        device=0 if torch.cuda.is_available() else -1
    )
    print("ИИ-модель успешно загружена.")
except Exception as e:
    print(f"Ошибка загрузки ИИ-модели: {e}")
    asr_pipeline = None

@app.get("/")
def read_root():
    return {"message": "Welcome to the Kazakh Speech Therapy AI Backend!"}

@app.post("/analyze-audio/")
async def analyze_audio(
    file: UploadFile = File(...),
    target_word: str = Form("рама")  # По умолчанию "рама" для обратной совместимости
):
    """
    Endpoint для получения аудио от мобильного/веб приложения, 
    конвертации в нужный формат и прогона через нейросеть.
    """
    # 1. Сохраняем оригинальный файл (.m4a/.webm/.wav)
    file_extension = file.filename.split('.')[-1]
    original_path = f"uploads/temp_upload.{file_extension}"
    
    with open(original_path, "wb") as f:
        f.write(await file.read())
        
    try:
        # 2. Конвертируем в формат, понятный нейросети: 16kHz, Mono, WAV
        audio = AudioSegment.from_file(original_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        wav_path = "uploads/processed_audio.wav"
        audio.export(wav_path, format="wav")
        
        # 3. Инференс (распознавание) с помощью нейросети
        transcription = ""
        if asr_pipeline is not None:
            # Модель принимает аудио и выдает текст/фонемы
            result = asr_pipeline(wav_path, generate_kwargs={"language": "kazakh"})
            transcription = result.get('text', '')
            
        # 4. Логика проверки произношения (MVP)
        target_word_lower = target_word.lower()
        transcription_lower = transcription.lower()
        
        status = "success"
        message = f"ИИ услышал: '{transcription}'."
        detected_errors = []
        
        # Динамическая базовая проверка
        if target_word_lower == "рама":
            if "л" in transcription_lower and "р" not in transcription_lower:
                detected_errors.append("Замена звука Р на Л (Ротацизм)")
                message += " Обнаружена логопедическая ошибка: замена Р на Л."
        elif target_word_lower == "лампа":
            if "р" in transcription_lower and "л" not in transcription_lower:
                detected_errors.append("Замена звука Л на Р")
                message += " Обнаружена ошибка: замена Л на Р."
        
        # Общая проверка
        if target_word_lower not in transcription_lower and transcription_lower != "" and not detected_errors:
             message += " Слово произнесено с искажениями или слишком тихо."
        elif transcription_lower == target_word_lower:
             message += " Отличное произношение! Ошибок нет."

        return {
            "filename": file.filename,
            "status": status,
            "message": message,
            "transcription": transcription,
            "detected_errors": detected_errors
        }
        
    except Exception as e:
        return {"status": "error", "message": f"Произошла ошибка при обработке: {str(e)}"}
    finally:
        # Удаляем временный оригинальный файл
        if os.path.exists(original_path):
            os.remove(original_path)
