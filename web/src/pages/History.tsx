import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History as HistoryIcon, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserAttempts, getUsers } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import '../index.css';

interface Attempt {
  id: number; target_word: string; transcription: string;
  detected_errors: string; accuracy: number; duration_ms: number;
  created_at: string; user_id: number;
}

function History() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'good' | 'needs-work'>('all');

  useEffect(() => {
    if (!user) { navigate('/'); return; }

    const fetchHistory = async () => {
      setLoading(true);
      try {
        let userIds: number[] = [];
        if (user.role === 'child') userIds = [user.id];
        else if (user.role === 'parent') {
          const usersData = await getUsers('child');
          userIds = usersData.users.filter((u: any) => u.parent_id === user.id).map((u: any) => u.id);
        } else if (user.role === 'therapist') {
          const usersData = await getUsers('child');
          userIds = usersData.users.filter((u: any) => u.therapist_id === user.id).map((u: any) => u.id);
        }

        const allAttempts: Attempt[] = [];
        for (const uid of userIds) {
          const data = await getUserAttempts(uid, 50);
          allAttempts.push(...data.attempts);
        }
        allAttempts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAttempts(allAttempts);
      } catch { setError(t('history.load_error')); }
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  const filteredAttempts = attempts.filter(a => {
    if (filter === 'good') return a.accuracy >= 70;
    if (filter === 'needs-work') return a.accuracy < 70;
    return true;
  });

  const getAccuracyColor = (acc: number) => {
    if (acc >= 90) return '#2ed573';
    if (acc >= 70) return '#ffa502';
    return '#ff4757';
  };

  const getAccuracyLabel = (acc: number) => {
    if (acc >= 90) return t('history.excellent');
    if (acc >= 70) return t('history.good');
    return t('history.needs_practice');
  };

  return (
    <div className="history-page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/')} aria-label={t('app.toMain')} title={t('app.toMain')}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="page-header-center">
          <h1><HistoryIcon size={24} /> {t('history.title')}</h1>
          <p className="page-subtitle">{t('history.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-banner"><span>{error}</span></div>}

      <div className="history-filters">
        <div className="filter-buttons">
          {[
            { key: 'all' as const, label: t('history.filter.all') },
            { key: 'good' as const, label: t('history.filter.good') },
            { key: 'needs-work' as const, label: t('history.filter.needs_work') },
          ].map(f => (
            <button key={f.key} className={`filter-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="history-summary">{t('history.total')} <strong>{filteredAttempts.length}</strong> {t('history.attempts')}</div>
      </div>

      {loading ? (
        <div className="page-center"><LoadingSpinner text={t('app.loading')} size="lg" /></div>
      ) : filteredAttempts.length === 0 ? (
        <div className="empty-state">
          <HistoryIcon size={48} />
          <p>{t('history.empty')}</p>
          <p className="empty-hint">{t('history.empty_hint')}</p>
        </div>
      ) : (
        <div className="history-timeline">
          {filteredAttempts.map((attempt, index) => {
            let errors: string[] = [];
            try { errors = JSON.parse(attempt.detected_errors); } catch { errors = []; }
            const date = new Date(attempt.created_at);
            const showDateHeader = index === 0 || 
              new Date(filteredAttempts[index - 1].created_at).toDateString() !== date.toDateString();

            return (
              <div key={attempt.id}>
                {showDateHeader && (
                  <div className="timeline-date-header">
                    <Calendar size={16} />
                    <span>{date.toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                )}
                <div className={`timeline-item ${attempt.accuracy >= 70 ? 'success' : 'error'}`}>
                  <div className="timeline-dot" style={{ backgroundColor: getAccuracyColor(attempt.accuracy) }} />
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-word">{attempt.target_word}</span>
                      <span className="timeline-time">{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="timeline-details">
                      {attempt.transcription && (
                        <span className="timeline-transcription">{t('history.recognized')} "{attempt.transcription}"</span>
                      )}
                      {errors.length > 0 && (
                        <div className="timeline-errors">
                          {errors.map((err, i) => <span key={i} className="timeline-error-tag">{err}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="timeline-footer">
                      <div className="timeline-accuracy-bar">
                        <div className="timeline-accuracy-fill" style={{ width: `${attempt.accuracy}%`, backgroundColor: getAccuracyColor(attempt.accuracy) }} />
                      </div>
                      <span className="timeline-accuracy-label" style={{ color: getAccuracyColor(attempt.accuracy) }}>
                        {Math.round(attempt.accuracy)}% — {getAccuracyLabel(attempt.accuracy)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default History;