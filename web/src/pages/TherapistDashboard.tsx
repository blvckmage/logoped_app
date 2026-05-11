import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, PlusCircle, Activity, 
  Stethoscope, TrendingUp, AlertTriangle,
  UserCheck, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getTherapistPatients } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import '../index.css';

interface Patient {
  id: number; name: string; age: number | null;
  total_attempts: number; avg_accuracy: number;
  last_active: string | null; problem_sounds?: string[];
}

function TherapistDashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      try {
        const therapistId = user?.id || 1;
        const data = await getTherapistPatients(therapistId);
        setPatients(data.patients);
      } catch {
        setError(t('therapist.load_error'));
      }
      setLoading(false);
    };
    fetchPatients();
  }, [user]);

  const getProgressInfo = (avgAccuracy: number) => {
    if (avgAccuracy >= 80) return { label: t('therapist.progress.good'), class: 'success', color: '#2ed573' };
    if (avgAccuracy >= 50) return { label: t('therapist.progress.medium'), class: 'warning', color: '#ffa502' };
    return { label: t('therapist.progress.beginner'), class: 'neutral', color: '#636e72' };
  };

  const getLastActiveLabel = (lastActive: string | null) => {
    if (!lastActive) return t('therapist.no_activity');
    const now = new Date();
    const last = new Date(lastActive);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('therapist.today');
    if (diffDays === 1) return t('therapist.yesterday');
    return `${diffDays} ${t('therapist.days_ago')}`;
  };

  const getActivityColor = (lastActive: string | null) => {
    if (!lastActive) return '#b2bec3';
    const now = new Date();
    const last = new Date(lastActive);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return '#2ed573';
    if (diffDays <= 3) return '#ffa502';
    return '#ff4757';
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: patients.length,
    avgAccuracy: patients.length > 0 
      ? Math.round(patients.reduce((sum, p) => sum + (p.avg_accuracy || 0), 0) / patients.length) 
      : 0,
    totalAttempts: patients.reduce((sum, p) => sum + p.total_attempts, 0),
    activeToday: patients.filter(p => {
      if (!p.last_active) return false;
      return new Date(p.last_active).toDateString() === new Date().toDateString();
    }).length,
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/')} aria-label={t('app.toMain')} title={t('app.toMain')}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="page-header-center">
          <h1><Stethoscope size={24} /> {t('therapist.title')}</h1>
          <p className="page-subtitle">{t('therapist.subtitle')}</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" disabled title={t('therapist.coming_soon')}>
            <PlusCircle size={18} /><span>{t('therapist.add_student')}</span>
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={20} /><span>{error}</span></div>}

      <div className="stats-grid-modern">
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(108,92,231,0.15)' }}><Users size={24} color="#6c5ce7" /></div>
          <div className="stat-content"><span className="stat-label">{t('therapist.stat.total')}</span><span className="stat-value">{stats.total}</span></div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(46,213,115,0.15)' }}><TrendingUp size={24} color="#2ed573" /></div>
          <div className="stat-content"><span className="stat-label">{t('therapist.stat.avg_accuracy')}</span><span className="stat-value">{stats.avgAccuracy}%</span></div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(78,205,196,0.15)' }}><Activity size={24} color="#4ECDC4" /></div>
          <div className="stat-content"><span className="stat-label">{t('therapist.stat.total_attempts')}</span><span className="stat-value">{stats.totalAttempts}</span></div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(255,165,2,0.15)' }}><UserCheck size={24} color="#ffa502" /></div>
          <div className="stat-content"><span className="stat-label">{t('therapist.stat.active_today')}</span><span className="stat-value">{stats.activeToday}</span></div>
        </div>
      </div>

      {!loading && !error && (
        <section className="dashboard-section">
          <div className="section-toolbar">
            <h3 className="section-title-with-icon"><Users size={20} /> {t('therapist.patients')}</h3>
            <div className="search-wrapper">
              <Search size={18} className="search-icon" />
              <input type="text" className="search-input" placeholder={t('therapist.search')}
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {patients.length === 0 ? (
            <div className="empty-state"><Users size={48} /><p>{t('therapist.no_patients')}</p></div>
          ) : (
            <div className="table-wrapper">
              <table className="patients-table-modern">
                <thead>
                  <tr>
                    <th>{t('therapist.patients')}</th>
                    <th>{t('therapist.age')}</th>
                    <th>{t('parent.stat.problem_sounds')}</th>
                    <th>Активность</th>
                    <th>Прогресс</th>
                    <th>{t('parent.stat.attempts')}</th>
                    <th>{t('parent.stat.avg_accuracy')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(patient => {
                    const progress = getProgressInfo(patient.avg_accuracy || 0);
                    return (
                      <tr key={patient.id}>
                        <td>
                          <div className="patient-cell">
                            <div className="patient-avatar-sm" style={{ backgroundColor: progress.color }}>{patient.name[0]}</div>
                            <span className="patient-name">{patient.name}</span>
                          </div>
                        </td>
                        <td>{patient.age || '—'} {patient.age ? t('therapist.age') : ''}</td>
                        <td>
                          <div className="tags">
                            {patient.problem_sounds && patient.problem_sounds.length > 0 
                              ? patient.problem_sounds.map((s: string) => <span key={s} className="tag">{s}</span>)
                              : <span className="no-problems">—</span>}
                          </div>
                        </td>
                        <td>
                          <div className="activity-cell">
                            <span className="activity-dot" style={{ backgroundColor: getActivityColor(patient.last_active) }} />
                            <span>{getLastActiveLabel(patient.last_active)}</span>
                          </div>
                        </td>
                        <td><span className={`progress-badge ${progress.class}`}>{progress.label}</span></td>
                        <td className="text-center">{patient.total_attempts}</td>
                        <td>
                          <div className="accuracy-cell">
                            <div className="accuracy-bar-sm">
                              <div className="accuracy-bar-fill" style={{ width: `${Math.min(patient.avg_accuracy || 0, 100)}%`, backgroundColor: progress.color }} />
                            </div>
                            <span className="accuracy-value">{Math.round(patient.avg_accuracy || 0)}%</span>
                          </div>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-outline" onClick={() => navigate('/parent')} title={t('therapist.view_stats')}>
                            <Activity size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {loading && <div className="page-center"><LoadingSpinner text={t('app.loading')} size="lg" /></div>}
    </div>
  );
}

export default TherapistDashboard;