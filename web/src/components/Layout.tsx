import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import {
  Home, Mic, BarChart3, Stethoscope, History,
  LogOut, User, Menu, X, Shield, LogIn,
} from 'lucide-react';
import '../index.css';

const ROLE_COLORS: Record<string, string> = {
  superadmin: '#7C3AED', admin: '#FF6B6B', therapist: '#4FC3F7',
  parent: '#10b981', child: '#FFB347',
};
const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Суперадмин', admin: 'Администратор', therapist: 'Логопед',
  parent: 'Родитель', child: 'Ребёнок',
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role ?? null;
  const color = role ? ROLE_COLORS[role] : '#FF6B6B';

  const navItems = [
    { path: '/', label: t('nav.home'), icon: <Home size={20} /> },
    { path: '/child',     label: t('nav.trainer'),   icon: <Mic size={20} />,          roles: ['child'] },
    { path: '/parent',    label: t('nav.parent'),     icon: <BarChart3 size={20} />,    roles: ['parent'] },
    { path: '/therapist', label: t('nav.therapist'),  icon: <Stethoscope size={20} />,  roles: ['therapist'] },
    { path: '/admin',     label: 'Управление',        icon: <Shield size={20} />,       roles: ['admin'] },
    { path: '/superadmin',label: 'Суперадмин',        icon: <Shield size={20} />,       roles: ['superadmin'] },
    { path: '/history',   label: t('nav.history'),    icon: <History size={20} />,      roles: ['child', 'parent', 'therapist', 'admin', 'superadmin'] },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => { logout(); navigate('/'); setSidebarOpen(false); };
  const handleNav = (path: string) => { navigate(path); setSidebarOpen(false); };

  const visibleItems = navItems.filter(item =>
    !item.roles || (role && item.roles.includes(role))
  );

  return (
    <div className="platform-layout">
      {/* ── NAVBAR ── */}
      <header className="top-navbar">
        <div className="navbar-left">
          <button className="navbar-burger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Меню">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="navbar-logo" onClick={() => navigate('/')}>🐾 Сөйле ИИ</div>
        </div>

        <nav className="navbar-desktop">
          {visibleItems.map(item => (
            <button key={item.path} className={`navbar-link ${isActive(item.path) ? 'active' : ''}`} onClick={() => navigate(item.path)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="navbar-right">
          <LanguageSwitcher />
          {user ? (
            <div className="navbar-user">
              <div className="navbar-user-avatar" style={{ backgroundColor: color }}>{user.name[0]}</div>
              <div className="navbar-user-info">
                <div className="navbar-user-name">{user.name}</div>
                <div className="navbar-user-role" style={{ color }}>{ROLE_LABELS[role ?? ''] ?? role}</div>
              </div>
              <button className="navbar-logout-btn" onClick={handleLogout} title="Выйти"><LogOut size={18} /></button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')} style={{ gap: '.4rem' }}>
              <LogIn size={14} /> Войти
            </button>
          )}
        </div>
      </header>

      {/* ── SIDEBAR OVERLAY ── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── MOBILE SIDEBAR ── */}
      <aside className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <div className="mobile-sidebar-logo">🐾 Сөйле ИИ</div>
        </div>
        <nav className="mobile-sidebar-nav">
          {visibleItems.map(item => (
            <button key={item.path} className={`mobile-sidebar-link ${isActive(item.path) ? 'active' : ''}`} onClick={() => handleNav(item.path)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mobile-sidebar-footer">
          <div className="mobile-sidebar-footer-lang"><LanguageSwitcher /></div>
          {user ? (
            <>
              <div className="mobile-sidebar-user">
                <div className="mobile-sidebar-user-avatar" style={{ backgroundColor: color }}>{user.name[0]}</div>
                <div>
                  <div className="mobile-sidebar-user-name">{user.name}</div>
                  <div className="mobile-sidebar-user-role" style={{ color }}>{ROLE_LABELS[role ?? ''] ?? role}</div>
                </div>
              </div>
              <button className="mobile-sidebar-logout" onClick={handleLogout}>
                <LogOut size={20} /><span>Выйти</span>
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => handleNav('/login')} style={{ margin: '.5rem 0' }}>
              <LogIn size={16} /> Войти
            </button>
          )}
        </div>
      </aside>

      {/* ── CONTENT ── */}
      <main className="main-content-navbar"><Outlet /></main>
    </div>
  );
}