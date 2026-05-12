import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, User, Activity, Calendar,
  TrendingUp, AlertTriangle, Clock, CheckCircle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getUser, getUserStats, getUserAttempts } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import '../index.css';

interface TrendPoint { day: string; attempts: number; avg_accuracy: number; }
interface SoundProgress { sound: string; accuracy: number; attempts_count: number; }
interface Stats {
  total_attempts: number;
  avg_accuracy: number;
  total_minutes: number;
  problem_sounds: string[];
  sound_progress: SoundProgress[];
  recent_attempts: any[];
  attempt_trend: TrendPoint[];
  accuracy_breakdown: { excellent: number; good: number; needs_practice: number };
}

// ── Tiny SVG line chart ─────────────────────────────────────────────────────
function TrendChart({ data }: { data: TrendPoint[] }) {
  const { t } = useLanguage();
  if (!data || data.length < 2) {
    return <p className="chart-empty">{t('patient.trend_empty')}</p>;
  }

  const W = 540; const H = 160; const PAD = { top: 16, right: 20, bottom: 36, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = 100;
  const xStep = innerW / (data.length - 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const polyline = data.map((d, i) => `${toX(i)},${toY(d.avg_accuracy)}`).join(' ');
  const area = [
    `M${toX(0)},${toY(data[0].avg_accuracy)}`,
    ...data.map((d, i) => `L${toX(i)},${toY(d.avg_accuracy)}`),
    `L${toX(data.length - 1)},${PAD.top + innerH}`,
    `L${toX(0)},${PAD.top + innerH}`,
    'Z',
  ].join(' ');

  const formatDay = (day: string) => {
    const d = new Date(day);
    return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart-svg" role="img" aria-label="Trend chart">
      {/* Y gridlines */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line
            x1={PAD.left} y1={toY(v)} x2={PAD.left + innerW} y2={toY(v)}
            stroke="rgba(255,255,255,0.07)" strokeWidth="1"
          />
          <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end"
            fontSize="10" fill="rgba(255,255,255,0.35)">{v}</text>
        </g>
      ))}
      {/* Area fill */}
      <path d={area} fill="url(#trendGrad)" opacity="0.25" />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.avg_accuracy)} r="4" fill="#6c5ce7" stroke="#fff" strokeWidth="1.5" />
          <text x={toX(i)} y={toY(d.avg_accuracy) - 9} textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.7)">{Math.round(d.avg_accuracy)}%</text>
        </g>
      ))}
      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle"
          fontSize="10" fill="rgba(255,255,255,0.4)">{formatDay(d.day)}</text>
      ))}
      {/* Gradients */}
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c5ce7" />
          <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a29bfe" />
          <stop offset="100%" stopColor="#6c5ce7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Donut chart for breakdown ───────────────────────────────────────────────
function BreakdownDonut({ excellent, good, practice }: { excellent: number; good: number; practice: number }) {
  const total = excellent + good + practice;
  if (total === 0) return null;

  const R = 52; const CX = 70; const CY = 70; const stroke = 18;
  const circ = 2 * Math.PI * R;

  const segments = [
    { value: excellent, color: '#2ed573', label: '≥90%' },
    { value: good,      color: '#ffa502', label: '70–89%' },
    { value: practice,  color: '#ff4757', label: '<70%' },
  ];

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const gap = circ - dash;
    const arc = { ...seg, dash, gap, offset: offset * circ };
    offset += pct;
    return arc;
  });

  return (
    <div className="donut-wrapper">
      <svg viewBox="0 0 140 140" className="donut-svg">
        {arcs.map((arc, i) => (
          <circle key={i}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">попыток</text>
      </svg>
      <div className="donut-legend">
        {[
          { label: `Отлично (≥90%)`, value: excellent, color: '#2ed573' },
          { label: `Хорошо (70–89%)`, value: good, color: '#ffa502' },
          { label: `Практика (<70%)`, value: practice, color: '#ff4757' },
        ].map(item => (
          <div key={item.label} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ backgroundColor: item.color }} />
            <span className="donut-legend-label">{item.label}</span>
            <span className="donut-legend-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const [patient, setPatient] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getAccuracyColor = (acc: number) => {
    if (acc >= 90) return '#2ed573';
    if (acc >= 70) return '#ffa502';
    return '#ff4757';
  };

  useEffect(() => {
    if (!id) return;
    const userId = parseInt(id, 10);
    (async () => {
      setLoading(true);
      try {
        const [userData, statsData, attemptsData] = await Promise.all([
          getUser(userId),
          getUserStats(userId),
          getUserAttempts(userId, 30),
        ]);
        setPatient(userData.user);
        setStats(statsData.stats);
        setAttempts(attemptsData.attempts);
      } catch {
        setError(t('patient.not_found'));
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="page-center"><LoadingSpinner text={t('app.loading')} size="lg" /></div>;
  if (error || !patient || !stats) {
    return (
      <div className="dashboard-page">
        <div className="error-banner"><AlertTriangle size={20} /><span>{error || t('patient.not_found')}</span></div>
        <button className="btn btn-ghost" onClick={() => navigate('/therapist')}><ArrowLeft size={18} /> {t('patient.back')}</button>
      </div>
    );
  }

  const breakdown = stats.accuracy_breakdown || { excellent: 0, good: 0, needs_practice: 0 };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/therapist')} aria-label={t('patient.back')}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="page-header-center">
          <h1><User size={24} /> {t('patient.title')}</h1>
          <p className="page-subtitle">{t('patient.subtitle')}</p>
        </div>
      </div>

      {/* Patient identity */}
      <div className="child-welcome">
        <div className="child-avatar" style={{ backgroundColor: '#6c5ce7', fontSize: '1.6rem' }}>
          {patient.name[0]}
        </div>
        <div>
          <h2>{patient.name}</h2>
          {patient.age && <p className="child-age-text">{patient.age} {t('therapist.age')}</p>}
          {stats.problem_sounds?.length > 0 && (
            <div className="tags" style={{ marginTop: 6 }}>
              {stats.problem_sounds.map(s => <span key={s} className="tag tag-danger">{s}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid-modern">
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(78,205,196,0.15)' }}><Clock size={24} color="#4ECDC4" /></div>
          <div className="stat-content"><span className="stat-label">{t('parent.stat.time')}</span><span className="stat-value">{stats.total_minutes} {t('parent.minutes')}</span></div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(46,213,115,0.15)' }}><CheckCircle size={24} color="#2ed573" /></div>
          <div className="stat-content"><span className="stat-label">{t('parent.stat.attempts')}</span><span className="stat-value">{stats.total_attempts}</span></div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(255,165,2,0.15)' }}><TrendingUp size={24} color="#ffa502" /></div>
          <div className="stat-content"><span className="stat-label">{t('parent.stat.avg_accuracy')}</span><span className="stat-value">{Math.round(stats.avg_accuracy)}%</span></div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(255,107,107,0.15)' }}><AlertTriangle size={24} color="#FF6B6B" /></div>
          <div className="stat-content">
            <span className="stat-label">{t('parent.stat.problem_sounds')}</span>
            <span className="stat-value">{stats.problem_sounds?.length > 0 ? stats.problem_sounds.join(', ') : t('parent.stat.none')}</span>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <section className="dashboard-section">
        <h3 className="section-title-with-icon"><TrendingUp size={20} /> {t('patient.trend')}</h3>
        <div className="chart-card">
          <TrendChart data={stats.attempt_trend || []} />
        </div>
      </section>

      {/* Breakdown donut */}
      <section className="dashboard-section">
        <h3 className="section-title-with-icon"><Activity size={20} /> {t('patient.breakdown')}</h3>
        <div className="chart-card">
          <BreakdownDonut
            excellent={breakdown.excellent || 0}
            good={breakdown.good || 0}
            practice={breakdown.needs_practice || 0}
          />
        </div>
      </section>

      {/* Sound progress */}
      {stats.sound_progress?.length > 0 && (
        <section className="dashboard-section">
          <h3 className="section-title-with-icon"><Activity size={20} /> {t('parent.sound_progress')}</h3>
          <div className="sound-progress-list-modern">
            {stats.sound_progress.map(sp => (
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
        <h3 className="section-title-with-icon"><Calendar size={20} /> {t('patient.recent')}</h3>
        <div className="attempts-list">
          {attempts.length === 0 ? (
            <div className="empty-state"><p>{t('parent.no_attempts')}</p></div>
          ) : (
            attempts.map(item => (
              <div key={item.id} className={`attempt-item ${item.accuracy >= 70 ? 'success' : 'error'}`}>
                <div className="attempt-left">
                  <span className="attempt-word">{item.target_word}</span>
                  <span className="attempt-transcription">{item.transcription ? `"${item.transcription}"` : t('parent.no_recognition')}</span>
                </div>
                <div className="attempt-center">
                  <div className="attempt-accuracy-bar">
                    <div className="attempt-accuracy-fill" style={{ width: `${item.accuracy}%`, backgroundColor: getAccuracyColor(item.accuracy) }} />
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
    </div>
  );
}

export default PatientDetail;
