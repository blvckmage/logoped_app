import { useNavigate } from 'react-router-dom';
import { Brain, Mic, LogIn } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  FoxCharacter, BearCharacter, OwlCharacter,
  StarDecor, HeartDecor, NoteDecor,
} from '../components/AnimalCharacters';

const roles = [
  {
    key: 'child',
    titleKey: 'home.child.title',
    descKey: 'home.child.description',
    featKeys: ['home.child.feature1', 'home.child.feature2', 'home.child.feature3'],
    path: '/child',
    btnColor: 'linear-gradient(135deg,#FF6B6B,#FF8C42)',
    animal: <FoxCharacter size={110} />,
    bg: 'rgba(255,107,107,0.06)',
    border: 'rgba(255,107,107,0.15)',
    allowedRoles: ['child'],
  },
  {
    key: 'parent',
    titleKey: 'home.parent.title',
    descKey: 'home.parent.description',
    featKeys: ['home.parent.feature1', 'home.parent.feature2', 'home.parent.feature3'],
    path: '/parent',
    btnColor: 'linear-gradient(135deg,#4FC3F7,#29B6F6)',
    animal: <BearCharacter size={110} />,
    bg: 'rgba(79,195,247,0.06)',
    border: 'rgba(79,195,247,0.15)',
    allowedRoles: ['parent', 'admin', 'superadmin'],
  },
  {
    key: 'therapist',
    titleKey: 'home.therapist.title',
    descKey: 'home.therapist.description',
    featKeys: ['home.therapist.feature1', 'home.therapist.feature2', 'home.therapist.feature3'],
    path: '/therapist',
    btnColor: 'linear-gradient(135deg,#9C6FD6,#C3A8E6)',
    animal: <OwlCharacter size={110} />,
    bg: 'rgba(195,168,230,0.06)',
    border: 'rgba(195,168,230,0.2)',
    allowedRoles: ['therapist', 'admin', 'superadmin'],
  },
];

function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  const getCardAction = (role: typeof roles[0]) => {
    if (!user) return { label: 'Войти', action: () => navigate('/login') };
    if (role.allowedRoles.includes(user.role)) return { label: 'Открыть кабинет', action: () => navigate(role.path) };
    if (user.role === 'child' && role.key === 'child') return { label: 'Тренироваться', action: () => navigate('/child') };
    return { label: 'Войти', action: () => navigate('/login') };
  };

  return (
    <div className="home-page">
      {/* ── HERO ── */}
      <section className="home-hero">
        <div className="hero-bubble hero-bubble-1" />
        <div className="hero-bubble hero-bubble-2" />
        <div className="hero-bubble hero-bubble-3" />
        <div className="hero-bubble hero-bubble-4" />

        <div className="hero-star hero-star-1"><StarDecor color="#FFE066" size={22} /></div>
        <div className="hero-star hero-star-2"><StarDecor color="#FF8C42" size={16} /></div>
        <div className="hero-star hero-star-3"><StarDecor color="#A8E6CF" size={20} /></div>

        <div className="hero-decor-fox"><FoxCharacter size={100} /></div>
        <div className="hero-decor-bear"><BearCharacter size={100} /></div>

        <div className="home-hero-content">
          <h1 className="home-title">
            Сөйле ИИ{' '}
            <span style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '.3rem' }}>
              <NoteDecor size={52} />
            </span>
          </h1>
          <p className="home-subtitle">{t('home.subtitle')}</p>

          <div className="home-hero-stats">
            <div className="hero-stat"><Brain size={18} /><span>{t('home.stat.ai')}</span></div>
            <div className="hero-stat"><Mic size={18} /><span>{t('home.stat.kazakh')}</span></div>
            <div className="hero-stat"><HeartDecor color="#FF6B6B" size={18} /><span>{t('home.stat.kids')}</span></div>
          </div>

          {!user && (
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/login')}>
                <LogIn size={16} /> Войти в систему
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/login')}>
                Зарегистрироваться
              </button>
            </div>
          )}

          {user && (
            <div style={{ marginTop: '1.25rem', padding: '.6rem 1.25rem', background: 'rgba(255,255,255,.8)', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '.5rem', border: '2px solid rgba(255,107,107,.15)', fontSize: '.88rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              👋 Привет, {user.name}!
            </div>
          )}
        </div>
      </section>

      {/* ── ROLE CARDS ── */}
      <section className="home-roles">
        <h2 className="section-title">{t('home.choose_role')}</h2>
        <div className="role-cards-grid">
          {roles.map(role => {
            const { label, action } = getCardAction(role);
            return (
              <div
                key={role.key}
                className="role-card-enhanced"
                style={{ background: role.bg, borderColor: role.border }}
                onClick={action}
              >
                <div className="role-card-animal">{role.animal}</div>
                <h3>{t(role.titleKey)}</h3>
                <p className="role-description">{t(role.descKey)}</p>
                <ul className="role-features">
                  {role.featKeys.map(k => (
                    <li key={k}><StarDecor color="#FFE066" size={14} /> {t(k)}</li>
                  ))}
                </ul>
                <button className="role-card-btn" style={{ background: role.btnColor }} onClick={e => { e.stopPropagation(); action(); }}>
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default Home;