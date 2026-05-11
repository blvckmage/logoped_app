import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { 
  Home, Mic, BarChart3, Stethoscope, History, 
  LogOut, User, Menu, X 
} from 'lucide-react';
import '../index.css';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role || null;

  const roleColors: Record<string, string> = {
    child: '#FF6B6B',
    parent: '#4ECDC4',
    therapist: '#6c5ce7',
  };

  const roleLabels: Record<string, string> = {
    child: t('role.child'),
    parent: t('role.parent'),
    therapist: t('role.therapist'),
  };

  const navItems = [
    { path: '/', label: t('nav.home'), icon: <Home size={20} /> },
    { path: '/child', label: t('nav.trainer'), icon: <Mic size={20} />, roles: ['child'] },
    { path: '/parent', label: t('nav.parent'), icon: <BarChart3 size={20} />, roles: ['parent'] },
    { path: '/therapist', label: t('nav.therapist'), icon: <Stethoscope size={20} />, roles: ['therapist'] },
    { path: '/history', label: t('nav.history'), icon: <History size={20} />, roles: ['child', 'parent', 'therapist'] },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
    setSidebarOpen(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const color = role ? roleColors[role] : '#FF6B6B';

  return (
    <div className="platform-layout">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="navbar-left">
          <button
            className="navbar-burger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Меню"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Desktop nav */}
        <nav className="navbar-desktop">
          {navItems.map((item) => {
            if (item.roles && (!role || !item.roles.includes(role))) return null;
            return (
              <button
                key={item.path}
                className={`navbar-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="navbar-right">
          <LanguageSwitcher />
          {user && (
            <div className="navbar-user">
              <div className="navbar-user-avatar" style={{ backgroundColor: color }}>
                <User size={16} />
              </div>
              <div className="navbar-user-info">
                <div className="navbar-user-name">{user.name}</div>
                <div className="navbar-user-role" style={{ color }}>{roleLabels[role || ''] || ''}</div>
              </div>
              <button className="navbar-logout-btn" onClick={handleLogout} title={t('app.logout')}>
                <LogOut size={18} />
              </button>
            </div>
          )}
          {!user && (
            <div className="navbar-guest">
              <span className="navbar-guest-text">{t('app.guest')}</span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <div className="mobile-sidebar-logo">
            <span>{t('app.title')}</span>
          </div>
        </div>

        <nav className="mobile-sidebar-nav">
          {navItems.map((item) => {
            if (item.roles && (!role || !item.roles.includes(role))) return null;
            return (
              <button
                key={item.path}
                className={`mobile-sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => handleNavigate(item.path)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mobile-sidebar-footer">
          <div className="mobile-sidebar-footer-lang">
            <LanguageSwitcher />
          </div>
          {user && (
            <div className="mobile-sidebar-user">
              <div className="mobile-sidebar-user-avatar" style={{ backgroundColor: color }}>
                <User size={20} />
              </div>
              <div className="mobile-sidebar-user-info">
                <div className="mobile-sidebar-user-name">{user.name}</div>
                <div className="mobile-sidebar-user-role" style={{ color }}>{roleLabels[role || ''] || ''}</div>
              </div>
            </div>
          )}
          <button className="mobile-sidebar-logout" onClick={handleLogout}>
            <LogOut size={20} />
            <span>{t('app.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content-navbar">
        <Outlet />
      </main>
    </div>
  );
}