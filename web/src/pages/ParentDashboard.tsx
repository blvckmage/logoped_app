import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, CheckCircle, AlertTriangle,
  BarChart3, User, Activity, TrendingUp, Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUsers, getUserStats, getUserAttempts } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import '../index.css';

interface ChildInfo { id: number; name: string; age: number | null; }
interface SoundProgress { sound: string; accuracy: number; attempts_count: number; }
interface TrendPoint { day: string; avg_accuracy: number; attempts: number; }
interface Stats {
  total_attempts: number; avg_accuracy: number; total_duration_ms: number;
  total_minutes: number; sound_progress: SoundProgress[]; recent_attempts: any[];
  problem_sounds: string[]; attempt_trend: TrendPoint[];
  accuracy_breakdown: { excellent: number; good: number; needs_practice: number };
}

// ── Mini SVG sparkline ──────────────────────────────────────────────────────
function Sparkline({ data }: { data: TrendPoint[] }) {
  const { t } = useLanguage();
  if (!data || data.length < 2) {
    return <p className="chart-empty">{t('patient.trend_empty')}</p>;
  }
  const W = 540; const H = 140;
  const PAD = { top: 16, right: 16, bottom: 32, left: 36 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const xStep = iW / (data.length - 1);
  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + iH - (v / 100) * iH;
  const pts = data.map((d, i) => `${toX(i)},${toY(d.avg_accuracy)}`).join(' ');
  const area = [
    `M${toX(0)},${toY(data[0].avg_accuracy)}`,
    ...data.map((d, i) => `L${toX(i)},${toY(d.avg_accuracy)}`),
    `L${toX(data.length - 1)},${PAD.top + iH}`,
    `L${toX(0)},${PAD.top + iH}`,
    'Z',
  ].join(' ');
  const fmt = (day: string) => { const d = new Date(day); return `${d.getDate()}.${(d.getMonth()+1).toString().padStart(2,'0')}`; };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart-svg">
      {[0, 50, 100].map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={toY(v)} x2={PAD.left+iW} y2={toY(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <text x={PAD.left-6} y={toY(v)+4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{v}</text>
        </g>
      ))}
      <path d={area} fill="url(#spkGrad)" opacity="0.25" />
      <polyline points={pts} fill="none" stroke="#4ECDC4" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.avg_accuracy)} r="4" fill="#4ECDC4" stroke="#fff" strokeWidth="1.5" />
          <text x={toX(i)} y={toY(d.avg_accuracy)-9} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.7)">{Math.round(d.avg_accuracy)}%</text>
          <text x={toX(i)} y={H-6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)">{fmt(d.day)}</text>
        </g>
      ))}
      <defs>
        <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ECDC4" />
          <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ParentDashboard() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { t, lang } = useLanguage();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinModal, setShowPinModal] = useState(!user || user.role !== 'parent');
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [childStats, setChildStats] = useState<Stats | null>(null);
  const [childAttempts, setChildAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [error, setError] = useState('');

  // Use AuthContext login — no duplicate auth logic
  const handlePinSubmit = async () => {
    if (pinInput.length < 4) { setPinError(t('auth.pin.required')); return; }
    setPinError('');
    setLoadingAuth(true);
    try {
      const loggedUser = await login(pinInput);
      if (loggedUser.role !== 'parent') {
        setPinError(t('auth.pin.error'));
        return;
      }
      setShowPinModal(false);
    } catch {
      setPinError(t('auth.pin.error'));
    }
    setLoadingAuth(false);
  };

  const parentUser = user?.role === 'parent' ? user : null;

  useEffect(() => {
    if (!parentUser) return;
    setShowPinModal(false);
    (async () => {
      setLoading(true);
      try {
        const usersData = await getUsers('child');
        const myChildren = usersData.users.filter((u: any) => u.parent_id === parentUser.id);
        setChildren(myChildren);
        if (myChildren.length > 0) setSelectedChildId(myChildren[0].id);
        else setError(t('parent.no_children'));
      } catch { setError(t('parent.load_error')); }
      setLoading(false);
    })();
  }, [parentUser?.id]);

  useEffect(() => {
    if (!selectedChildId) return;
    (async () => {
      setLoading(true);
      try {
        const [statsData, attemptsData] = await Promise.all([
          getUserStats(selectedChildId),
          getUserAttempts(selectedChildId, 20),
        ]);
        setChildStats(statsData.stats);
        setChildAttempts(attemptsData.attempts);
      } catch { setError(t('parent.stats_error')); }
      setLoading(false);
    })();
  }, [selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  if (showPinModal) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <button className="btn btn-ghost back-btn-fixed" onClick={() => navigate('/')}><ArrowLeft size={20} /> {t('app.back')}</button>
          <div className="auth-header">
            <User size={48} className="auth-icon" />
            <h1>{t('auth.parent.title')}</h1>
            <p>{t('auth.parent.subtitle')}</p>
          </div>
          <div className="auth-form">
            <input
              id="parent-pin-input"
              type="password"
              className="pin-input-lg"
              maxLength={4}
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
              placeholder={t('auth.pin.placeholder')}
              autoFocus
            />
            <button
              id="parent-pin-submit"
              className="btn btn-primary btn-block"
              onClick={handlePinSubmit}
              disabled={loadingAuth}
            >
              {loadingAuth ? t('app.loading') : t('auth.pin.button')}
            </button>
            {pinError && <p className="auth-error">{pinError}</p>}
            <p className="auth-hint">{t('auth.pin.hint')}1111</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !childStats) return <div className="page-center"><LoadingSpinner text={t('app.loading')} size="lg" /></div>;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/')} aria-label={t('app.toMain')}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="page-header-center">
          <h1><BarChart3 size={24} /> {t('parent.title')}</h1>
          <p className="page-subtitle">{t('parent.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={20} /><span>{error}</span></div>}

      {children.length > 1 && (
        <section className="child-selector">
          <label>{t('parent.select_child')}</label>
          <div className="child-selector-buttons">
            {children.map(child => (
              <button key={child.id} className={`child-select-btn ${selectedChildId === child.id ? 'active' : ''}`}
                onClick={() => setSelectedChildId(child.id)}>
                <User size={16} /><span>{child.name}</span>
                {child.age && <span className="child-age">{child.age} {t('parent.years')}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedChild && childStats && (
        <>
          <div className="child-welcome">
            <div className="child-avatar" style={{ backgroundColor: '#4ECDC4' }}>{selectedChild.name[0]}</div>
            <div><h2>{selectedChild.name}</h2>{selectedChild.age && <p className="child-age-text">{selectedChild.age} {t('parent.years')}</p>}</div>
          </div>

          {/* Summary stats */}
          <div className="stats-grid-modern">
            <div className="stat-card-modern">
              <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(78,205,196,0.15)' }}><Clock size={24} color="#4ECDC4" /></div>
              <div className="stat-content"><span className="stat-label">{t('parent.stat.time')}</span><span className="stat-value">{childStats.total_minutes} {t('parent.minutes')}</span></div>
            </div>
            <div className="stat-card-modern">
              <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(46,213,115,0.15)' }}><CheckCircle size={24} color="#2ed573" /></div>
              <div className="stat-content"><span className="stat-label">{t('parent.stat.attempts')}</span><span className="stat-value">{childStats.total_attempts}</span></div>
            </div>
            <div className="stat-card-modern">
              <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(255,165,2,0.15)' }}><TrendingUp size={24} color="#ffa502" /></div>
              <div className="stat-content"><span className="stat-label">{t('parent.stat.avg_accuracy')}</span><span className="stat-value">{Math.round(childStats.avg_accuracy)}%</span></div>
            </div>
            <div className="stat-card-modern">
              <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(255,107,107,0.15)' }}><AlertTriangle size={24} color="#FF6B6B" /></div>
              <div className="stat-content">
                <span className="stat-label">{t('parent.stat.problem_sounds')}</span>
                <span className="stat-value">{childStats.problem_sounds?.length > 0 ? childStats.problem_sounds.join(', ') : t('parent.stat.none')}</span>
              </div>
            </div>
          </div>

          {/* Trend chart */}
          {childStats.attempt_trend && childStats.attempt_trend.length >= 2 && (
            <section className="dashboard-section">
              <h3 className="section-title-with-icon"><TrendingUp size={20} /> {t('patient.trend')}</h3>
              <div className="chart-card">
                <Sparkline data={childStats.attempt_trend} />
              </div>
            </section>
          )}

          {/* Sound progress */}
          {childStats.sound_progress?.length > 0 && (
            <section className="dashboard-section">
              <h3 className="section-title-with-icon"><Activity size={20} /> {t('parent.sound_progress')}</h3>
              <div className="sound-progress-list-modern">
                {childStats.sound_progress.map(sp => (
                  <div key={sp.sound} className="sound-progress-item-modern">
                    <div className="sound-avatar" style={{ backgroundColor: sp.accuracy >= 80 ? '#2ed573' : sp.accuracy >= 50 ? '#ffa502' : '#ff4757' }}>{sp.sound}</div>
                    <div className="sound-progress-info">
                      <div className="sound-progress-header">
                        <span className="sound-progress-letter">{t('parent.sound')} {sp.sound}</span>
                        <span className="sound-progress-pct">{Math.round(sp.accuracy)}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${sp.accuracy}%`, backgroundColor: sp.accuracy >= 80 ? '#2ed573' : sp.accuracy >= 50 ? '#ffa502' : '#ff4757' }} />
                      </div>
                      <span className="sound-progress-count">{sp.attempts_count} {t('parent.attempts_count')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent attempts */}
          <section className="dashboard-section">
            <h3 className="section-title-with-icon"><Calendar size={20} /> {t('parent.recent_attempts')}</h3>
            <div className="attempts-list">
              {childAttempts.length === 0 ? (
                <div className="empty-state"><p>{t('parent.no_attempts')}</p></div>
              ) : (
                childAttempts.map(item => (
                  <div key={item.id} className={`attempt-item ${item.accuracy >= 70 ? 'success' : 'error'}`}>
                    <div className="attempt-left">
                      <span className="attempt-word">{item.target_word}</span>
                      <span className="attempt-transcription">{item.transcription ? `"${item.transcription}"` : t('parent.no_recognition')}</span>
                    </div>
                    <div className="attempt-center">
                      <div className="attempt-accuracy-bar">
                        <div className="attempt-accuracy-fill" style={{ width: `${item.accuracy}%`, backgroundColor: item.accuracy >= 90 ? '#2ed573' : item.accuracy >= 70 ? '#ffa502' : '#ff4757' }} />
                      </div>
                      <span className="attempt-accuracy-text">{Math.round(item.accuracy)}%</span>
                    </div>
                    <div className="attempt-right">
                      <span className="attempt-badge">{item.accuracy >= 90 ? t('parent.excellent') : item.accuracy >= 70 ? t('parent.good') : t('parent.needs_practice')}</span>
                      <span className="attempt-date">{new Date(item.created_at).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default ParentDashboard;