import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, RefreshCw, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { analyzeAudio } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import '../index.css';

interface SoundTarget {
  id: string;
  letter: string;
  word: string;
  examples: string[];
}

const SOUND_TARGETS: SoundTarget[] = [
  { id: 'R',  letter: 'Р', word: 'Рама',  examples: ['Рама', 'Рак', 'Рыба', 'Рука'] },
  { id: 'L',  letter: 'Л', word: 'Лампа', examples: ['Лампа', 'Луна', 'Ложка', 'Лиса'] },
  { id: 'Q',  letter: 'Қ', word: 'Қала',  examples: ['Қала', 'Қар', 'Қол', 'Қас'] },
  { id: 'S',  letter: 'С', word: 'Сыр',   examples: ['Сыр', 'Сөз', 'Сан', 'Су'] },
  { id: 'SH', letter: 'Ш', word: 'Шар',   examples: ['Шар', 'Шелек', 'Шаш', 'Шығу'] },
  { id: 'CH', letter: 'Ч', word: 'Чашка', examples: ['Чашка', 'Чай', 'Чудо', 'Часы'] },
];

interface AnalysisResult {
  status: string;
  message: string;
  transcription: string;
  target_word: string;
  accuracy: number;
  detected_errors: string[];
  processing_time_ms: number;
  attempt_id?: number;
}

function ChildTrainer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTarget, setActiveTarget] = useState<SoundTarget>(SOUND_TARGETS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastAudioUpdateRef = useRef<number>(0);

  useEffect(() => {
    setResult(null);
  }, [activeTarget]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const newLevel = Math.min(avg / 128, 1);

        const now = performance.now();
        if (now - lastAudioUpdateRef.current > 100) {
          lastAudioUpdateRef.current = now;
          setAudioLevel(newLevel);
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        uploadAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioLevel(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResult(null);
    } catch {
      alert(t('trainer.mic_error'));
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
      const data = await analyzeAudio(audioBlob, activeTarget.word, user?.id || undefined);
      setResult(data);
    } catch {
      setResult({
        status: 'error',
        message: t('trainer.result.server_error'),
        transcription: '',
        target_word: activeTarget.word,
        accuracy: 0,
        detected_errors: [],
        processing_time_ms: 0,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const getAccuracyColor = (acc: number) => {
    if (acc >= 90) return '#2ed573';
    if (acc >= 70) return '#ffa502';
    if (acc >= 40) return '#ff6348';
    return '#ff4757';
  };

  const getAccuracyLabel = (acc: number) => {
    if (acc >= 90) return t('trainer.result.excellent');
    if (acc >= 70) return t('trainer.result.good');
    if (acc >= 40) return t('trainer.result.needs_practice');
    return t('trainer.result.try_again');
  };

  const circleCircumference = 2 * Math.PI * 54;

  return (
    <div className="trainer-page">
      <div className="page-header">
        <div className="page-header-left">
          <button id="trainer-back-btn" className="btn btn-ghost" onClick={() => navigate('/')} aria-label={t('app.toMain')} title={t('app.toMain')}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="page-header-center">
          <h1><Mic size={24} /> {t('trainer.title')}</h1>
          <p className="page-subtitle">{t('trainer.subtitle')}</p>
        </div>
      </div>

      <div className="trainer-content">
        <section className="trainer-section">
          <h3>{t('trainer.choose')}</h3>
          <div className="sound-buttons-grid">
            {SOUND_TARGETS.map((target) => (
              <button
                key={target.id}
                className={`sound-chip ${activeTarget.id === target.id ? 'active' : ''}`}
                onClick={() => setActiveTarget(target)}
                disabled={isRecording || isProcessing}
              >
                <span className="sound-chip-letter">{target.letter}</span>
                <span className="sound-chip-word">{target.word}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="trainer-section active-word-section">
          <div className="word-card">
            <span className="word-card-label">{t('trainer.say')}</span>
            <span className="word-card-word">{activeTarget.word}</span>
            <div className="word-card-examples">
              {activeTarget.examples.map((ex) => (
                <span key={ex} className="example-chip">{ex}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="trainer-section recording-section">
          <div className="record-area">
            <div className="record-circle-container">
              <svg className="record-circle-svg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e9ecef" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke={getAccuracyColor(result?.accuracy || 0)} strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={result ? circleCircumference - (result.accuracy / 100) * circleCircumference : circleCircumference}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
                />
              </svg>
              <button
                id="record-btn"
                className={`record-btn-circle ${isRecording ? 'recording' : ''}`}
                onClick={handleToggleRecording}
                disabled={isProcessing}
              >
                {isProcessing ? <LoadingSpinner size="sm" text="" /> : isRecording ? <Square size={32} /> : <Mic size={32} />}
              </button>
              {isRecording && (
                <div className="audio-level-ring" style={{ transform: `scale(${1 + audioLevel * 0.3})` }} />
              )}
            </div>
            <div className="record-status">
              {isRecording && <span className="status-recording">{t('trainer.record.in_progress')}</span>}
              {isProcessing && <span className="status-processing">{t('trainer.record.processing')}</span>}
              {!isRecording && !isProcessing && !result && (
                <span className="status-idle">{t('trainer.record.start')}</span>
              )}
            </div>
          </div>
        </section>

        {result && (
          <section className="trainer-section result-section">
            <div className={`result-card-platform ${result.accuracy >= 70 ? 'success' : 'error'}`}>
              <div className="result-header">
                <div className="result-accuracy-display">
                  <span className="result-accuracy-value" style={{ color: getAccuracyColor(result.accuracy) }}>
                    {Math.round(result.accuracy)}%
                  </span>
                  <span className="result-accuracy-label">{getAccuracyLabel(result.accuracy)}</span>
                </div>
                <div className="result-icons">
                  {result.accuracy >= 70 ? <CheckCircle2 size={32} color="#2ed573" /> : <XCircle size={32} color="#ff4757" />}
                </div>
              </div>
              <div className="result-body">
                <p className="result-message">{result.message}</p>
                {result.transcription && (
                  <div className="result-transcription">
                    <span className="result-label">{t('trainer.result.recognized')}</span>
                    <span className="result-value">"{result.transcription}"</span>
                  </div>
                )}
                {result.detected_errors && result.detected_errors.length > 0 && (
                  <div className="result-errors">
                    <span className="result-label">{t('trainer.result.errors')}</span>
                    <ul>
                      {result.detected_errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="result-meta">
                  <span className="result-meta-item">{t('trainer.result.goal')} <strong>{result.target_word}</strong></span>
                  <span className="result-meta-item">{t('trainer.result.time')} <strong>{result.processing_time_ms}{t('trainer.result.ms')}</strong></span>
                </div>
              </div>
              <button className="btn btn-primary try-again-btn" onClick={() => setResult(null)}>
                <RefreshCw size={18} />
                <span>{t('trainer.record.try_again')}</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default ChildTrainer;