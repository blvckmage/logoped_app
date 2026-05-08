import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../index.css';

// Используем локальный IP или localhost
const BACKEND_URL = 'http://127.0.0.1:8000';

const SOUND_TARGETS = [
  { id: 'R', letter: 'Р', word: 'Рама' },
  { id: 'L', letter: 'Л', word: 'Лапа' },
  { id: 'Q', letter: 'Қ', word: 'Қала' },
];

function ChildTrainer() {
  const navigate = useNavigate();
  const [activeTarget, setActiveTarget] = useState(SOUND_TARGETS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Reset result when target changes
    setResult(null);
  }, [activeTarget]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        uploadAudio(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResult(null);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Пожалуйста, разрешите доступ к микрофону.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('target_word', activeTarget.word);

      const response = await fetch(`${BACKEND_URL}/analyze-audio/`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Upload failed:', error);
      setResult({ status: 'error', message: 'Не удалось отправить запись на сервер. Убедитесь, что бэкенд запущен.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="app-container">
      <button className="back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={24} /> Назад
      </button>

      <header className="header">
        <h1>Сөйле ИИ</h1>
        <p>Умный логопед в твоем браузере</p>
      </header>

      <section className="target-selection">
        <h3>Выбери звук для тренировки:</h3>
        <div className="sound-buttons">
          {SOUND_TARGETS.map(target => (
            <button 
              key={target.id}
              className={`sound-btn ${activeTarget.id === target.id ? 'active' : ''}`}
              onClick={() => setActiveTarget(target)}
              disabled={isRecording || isProcessing}
            >
              {target.letter}
            </button>
          ))}
        </div>
      </section>

      <section className="recording-area">
        <button 
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleToggleRecording}
          disabled={isProcessing}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>
        
        <div className="target-word-display">
          Скажи: "{activeTarget.word}"
        </div>
      </section>

      {isProcessing && (
        <div className="processing-indicator">
          <p>Анализирую твой голос...</p>
        </div>
      )}

      {result && (
        <div className={`result-card ${result.detected_errors?.length > 0 ? 'error' : 'success'}`}>
          <p className="result-message">{result.message}</p>
          {result.transcription && (
            <p className="transcription">Что я услышал: "{result.transcription}"</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ChildTrainer;
