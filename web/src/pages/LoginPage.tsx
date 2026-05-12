import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { registerParent } from '../services/api';
import { OwlCharacter } from '../components/AnimalCharacters';

type Mode = 'select' | 'pin' | 'email' | 'register';

function LoginPage() {
  const navigate = useNavigate();
  const { login, loginEmail, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('select');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const busy = isLoading || loading;

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(pin);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Неверный PIN-код');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const user = await loginEmail(email, password);
      if (user.role === 'superadmin') navigate('/superadmin');
      else if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'therapist') navigate('/therapist');
      else if (user.role === 'parent') navigate('/parent');
      else navigate('/');
    } catch (err: any) {
      setError(err.message || 'Неверный email или пароль');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      const { access_token, user } = await registerParent(name, email, password);
      localStorage.setItem('authToken', access_token);
      localStorage.setItem('authUser', JSON.stringify(user));
      window.location.href = '/parent';
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {mode !== 'select' && (
          <button className="btn btn-ghost btn-sm back-btn-fixed" onClick={() => { setMode('select'); setError(''); }}>
            <ArrowLeft size={16} /> Назад
          </button>
        )}

        {/* SELECT MODE */}
        {mode === 'select' && (
          <>
            <div className="auth-header">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '.5rem' }}>
                <OwlCharacter size={80} />
              </div>
              <h1>Войти в Сөйле ИИ</h1>
              <p>Выберите способ входа</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              <button className="btn btn-primary btn-block" onClick={() => setMode('pin')}>
                🔢 Войти по PIN-коду
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => setMode('email')}>
                <Mail size={16} /> Войти по Email
              </button>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem', padding: '.5rem 0' }}>
                — или —
              </div>
              <button className="btn btn-outline btn-block" onClick={() => setMode('register')}>
                <User size={16} /> Зарегистрироваться (родитель)
              </button>
            </div>
          </>
        )}

        {/* PIN LOGIN */}
        {mode === 'pin' && (
          <>
            <div className="auth-header">
              <h1>Вход по PIN</h1>
              <p>Введите 4-значный PIN-код ребёнка или родителя</p>
            </div>
            <form className="auth-form" onSubmit={handlePinLogin}>
              <input
                id="pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="pin-input-lg"
                autoFocus
              />
              {error && <div className="auth-error">{error}</div>}
              <button className="btn btn-primary btn-block" type="submit" disabled={pin.length < 4 || busy}>
                {busy ? 'Вход...' : 'Войти'}
              </button>
            </form>
            <div className="auth-hint" style={{ marginTop: '1rem' }}>
              Демо PIN: 1234 (Амина), 5678 (Тимур), 1111 (Родитель)
            </div>
          </>
        )}

        {/* EMAIL LOGIN */}
        {mode === 'email' && (
          <>
            <div className="auth-header">
              <h1>Вход по Email</h1>
              <p>Для логопедов, родителей и администраторов</p>
            </div>
            <form className="auth-form" onSubmit={handleEmailLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Пароль</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? 'Вход...' : 'Войти'}
              </button>
            </form>
            <div className="auth-hint" style={{ marginTop: '1rem' }}>
              Демо: superadmin@logoped.kz / admin123
            </div>
          </>
        )}

        {/* REGISTER */}
        {mode === 'register' && (
          <>
            <div className="auth-header">
              <h1>Регистрация родителя</h1>
              <p>Создайте аккаунт для отслеживания прогресса ребёнка</p>
            </div>
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Ваше имя</label>
                <input className="form-input" type="text" placeholder="Анна Иванова" value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Пароль (мин. 6 символов)</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button className="btn btn-primary btn-block" type="submit" disabled={busy || !name || !email || !password}>
                {busy ? 'Создание...' : 'Создать аккаунт'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
