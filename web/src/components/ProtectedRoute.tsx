import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldOff } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If provided, only these roles can access the route */
  roles?: ('child' | 'parent' | 'therapist')[];
}

/**
 * Wraps a route and shows an access-denied screen if the user
 * is not authenticated or does not have the required role.
 */
export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <ShieldOff size={52} style={{ color: '#FF6B6B', marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Требуется авторизация</h2>
          <p style={{ color: 'rgba(0,0,0,0.45)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Войдите через PIN-код, чтобы открыть эту страницу.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
            {t('app.home')}
          </button>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(user.role as any)) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <ShieldOff size={52} style={{ color: '#ffa502', marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Доступ запрещён</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: '1.5rem' }}>
            У вас нет прав для просмотра этой страницы.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>
            {t('app.home')}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
