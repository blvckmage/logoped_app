import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Baby, Users, Stethoscope, Brain, Sparkles, Mic } from 'lucide-react';
import '../index.css';

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const roles = [
    {
      id: 'child',
      title: t('home.child.title'),
      description: t('home.child.desc'),
      icon: <Baby size={48} />,
      color: '#FF6B6B',
      path: '/child',
      features: [t('home.child.feature1'), t('home.child.feature2'), t('home.child.feature3')],
    },
    {
      id: 'parent',
      title: t('home.parent.title'),
      description: t('home.parent.desc'),
      icon: <Users size={48} />,
      color: '#4ECDC4',
      path: '/parent',
      features: [t('home.parent.feature1'), t('home.parent.feature2'), t('home.parent.feature3')],
    },
    {
      id: 'therapist',
      title: t('home.therapist.title'),
      description: t('home.therapist.desc'),
      icon: <Stethoscope size={48} />,
      color: '#6c5ce7',
      path: '/therapist',
      features: [t('home.therapist.feature1'), t('home.therapist.feature2'), t('home.therapist.feature3')],
    },
  ];

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-title">
            {t('home.title')} <Sparkles className="inline-icon" size={40} />
          </h1>
          <p className="home-subtitle">{t('home.subtitle')}</p>
          <div className="home-hero-stats">
            <div className="hero-stat">
              <Brain size={24} />
              <span>{t('home.stat.ai')}</span>
            </div>
            <div className="hero-stat">
              <Mic size={24} />
              <span>{t('home.stat.speech')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="home-roles">
        <h2 className="section-title">{t('home.choose')}</h2>
        <div className="role-cards-grid">
          {roles.map((role) => (
            <div
              key={role.id}
              className="role-card-enhanced"
              style={{ '--role-color': role.color } as React.CSSProperties}
              onClick={() => navigate(role.path)}
            >
              <div className="role-card-icon" style={{ color: role.color }}>
                {role.icon}
              </div>
              <h3>{role.title}</h3>
              <p className="role-description">{role.description}</p>
              <ul className="role-features">
                {role.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <button className="role-card-btn" style={{ backgroundColor: role.color }}>
                {user?.role === role.id ? t('home.go') : t('home.enter')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;