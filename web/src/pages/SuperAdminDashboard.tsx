import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Shield, Search, RefreshCw, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, deleteUser, updateUser, type User } from '../services/api';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Суперадмин', admin: 'Администратор', therapist: 'Логопед',
  parent: 'Родитель', child: 'Ребёнок',
};
const ROLE_COLORS: Record<string, string> = {
  superadmin: '#7C3AED', admin: '#FF6B6B', therapist: '#4FC3F7',
  parent: '#10b981', child: '#FFB347',
};

interface CreateForm {
  name: string; role: string; email: string; password: string;
  pin_code: string; age: string; parent_id: string; therapist_id: string;
}

const EMPTY_FORM: CreateForm = {
  name: '', role: 'parent', email: '', password: '',
  pin_code: '', age: '', parent_id: '', therapist_id: '',
};

function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers(filterRole || undefined);
      setUsers(data.users);
    } catch { }
    setLoading(false);
  }, [filterRole]);

  useEffect(() => { load(); }, [load]);

  if (!me || (me.role !== 'superadmin' && me.role !== 'admin')) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <Shield size={48} style={{ color: 'var(--red)', margin: '0 auto 1rem' }} />
          <h2>Нет доступа</h2>
          <button className="btn btn-primary" onClick={() => navigate('/')}>На главную</button>
        </div>
      </div>
    );
  }

  const canCreate = (role: string) => {
    const levels: Record<string, number> = { superadmin: 4, admin: 3, therapist: 2, parent: 1, child: 0 };
    return (levels[me.role] ?? 0) > (levels[role] ?? 99);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Введите имя'); return; }
    if (form.role === 'child' && !form.pin_code) { setFormError('Введите PIN для ребёнка'); return; }
    if (form.role !== 'child' && !form.email) { setFormError('Введите email'); return; }
    if (form.role !== 'child' && !form.password) { setFormError('Введите пароль'); return; }
    setSubmitting(true);
    try {
      await createUser({
        name: form.name, role: form.role,
        email: form.role !== 'child' ? form.email : undefined,
        password: form.role !== 'child' ? form.password : undefined,
        pin_code: form.pin_code || undefined,
        age: form.age ? parseInt(form.age) : undefined,
        parent_id: form.parent_id ? parseInt(form.parent_id) : undefined,
        therapist_id: form.therapist_id ? parseInt(form.therapist_id) : undefined,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка создания');
    }
    setSubmitting(false);
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (!confirm(`Удалить пользователя "${userName}"? Это действие нельзя отменить.`)) return;
    try { await deleteUser(userId); await load(); } catch (err: any) { alert(err.message); }
  };

  const handleToggleActive = async (u: User) => {
    try { await updateUser(u.id, { is_active: u.is_active ? 0 : 1 }); await load(); } catch { }
  };

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <Shield size={22} style={{ color: ROLE_COLORS[me.role] }} />
        </div>
        <div className="page-header-center">
          <h1><Shield size={20} /> {ROLE_LABELS[me.role]}</h1>
          <p className="page-subtitle">Управление пользователями системы</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="stats-grid-modern" style={{ marginBottom: '1.5rem' }}>
        {['admin', 'therapist', 'parent', 'child'].filter(r => canCreate(r) || me.role === 'superadmin').map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="stat-card-modern">
              <div className="stat-icon-wrapper" style={{ background: ROLE_COLORS[role] + '22' }}>
                <Users size={20} style={{ color: ROLE_COLORS[role] }} />
              </div>
              <div className="stat-content">
                <span className="stat-label">{ROLE_LABELS[role]}</span>
                <span className="stat-value">{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="dashboard-section">
        <div className="section-toolbar">
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            {['', 'admin', 'therapist', 'parent', 'child'].map(r => (
              <button key={r} className={`filter-btn ${filterRole === r ? 'active' : ''}`} onClick={() => setFilterRole(r)}>
                {r ? ROLE_LABELS[r] : 'Все'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <div className="search-wrapper">
              <Search size={14} className="search-icon" />
              <input className="search-input" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setFormError(''); setForm(EMPTY_FORM); }}>
              <Plus size={14} /> Создать
            </button>
          </div>
        </div>

        {loading ? (
          <div className="page-center"><div className="loading-spinner"><div className="spinner-ring" /><span className="spinner-text">Загрузка...</span></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><Users size={36} /><p>Пользователи не найдены</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="patients-table-modern">
              <thead><tr>
                <th>Пользователь</th><th>Роль</th><th>Email</th>
                <th>Статус</th><th>Дата создания</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="table-row-clickable">
                    <td>
                      <div className="patient-cell">
                        <div className="patient-avatar-sm" style={{ background: ROLE_COLORS[u.role] }}>
                          {u.name[0]}
                        </div>
                        <div>
                          <div className="patient-name">{u.name}</div>
                          {u.age && <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{u.age} лет</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="progress-badge" style={{ background: ROLE_COLORS[u.role] + '18', color: ROLE_COLORS[u.role], borderColor: ROLE_COLORS[u.role] + '40' }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>{u.email || (u.pin_code ? `PIN: ${u.pin_code}` : '—')}</td>
                    <td>
                      {u.is_active
                        ? <span className="progress-badge success">Активен</span>
                        : <span className="progress-badge neutral">Отключён</span>}
                    </td>
                    <td style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '.35rem' }}>
                        {canCreate(u.role) && (
                          <>
                            <button title={u.is_active ? 'Деактивировать' : 'Активировать'} className="btn btn-ghost btn-sm" onClick={() => handleToggleActive(u)}>
                              {u.is_active ? <XCircle size={14} style={{ color: 'var(--orange)' }} /> : <CheckCircle size={14} style={{ color: 'var(--green)' }} />}
                            </button>
                            <button title="Удалить" className="btn btn-ghost btn-sm" onClick={() => handleDelete(u.id, u.name)}>
                              <Trash2 size={14} style={{ color: 'var(--red)' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-header-icon"><Plus size={18} /></div>
              <span className="modal-title">Создать пользователя</span>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Имя *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Введите имя" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Роль *</label>
                  <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {['admin', 'therapist', 'parent', 'child'].filter(canCreate).map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.role !== 'child' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Пароль *</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Мин. 6 символов" style={{ paddingRight: '2.5rem' }} />
                      <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {form.role === 'child' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">PIN-код *</label>
                      <input className="form-input" type="text" inputMode="numeric" maxLength={6} value={form.pin_code} onChange={e => setForm({ ...form, pin_code: e.target.value.replace(/\D/g, '') })} placeholder="1234" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Возраст</label>
                      <input className="form-input" type="number" min={1} max={18} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} placeholder="5" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">ID родителя</label>
                      <input className="form-input" type="number" value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })} placeholder="ID" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ID логопеда</label>
                      <input className="form-input" type="number" value={form.therapist_id} onChange={e => setForm({ ...form, therapist_id: e.target.value })} placeholder="ID" />
                    </div>
                  </div>
                </>
              )}

              {formError && <div className="form-error">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperAdminDashboard;
