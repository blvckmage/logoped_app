import { useState } from 'react';
import { X, UserPlus, Loader } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { createUser } from '../services/api';
import '../index.css';

interface AddStudentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStudentModal({ onClose, onSuccess }: AddStudentModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError(t('add_student.name')); return; }
    if (!/^\d{4}$/.test(pin)) { setError(t('add_student.pin_invalid')); return; }

    setLoading(true);
    try {
      await createUser({
        name: name.trim(),
        role: 'child',
        pin_code: pin,
        age: age ? parseInt(age, 10) : undefined,
        therapist_id: user?.id,
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch {
      setError(t('add_student.error'));
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon">
            <UserPlus size={22} />
          </div>
          <h2 className="modal-title">{t('add_student.title')}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="modal-success">
            <span className="modal-success-icon">✅</span>
            <p>{t('add_student.success')}</p>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('add_student.name')}</label>
              <input
                id="student-name"
                type="text"
                className="form-input"
                placeholder={t('add_student.name_placeholder')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('add_student.age')}</label>
                <input
                  id="student-age"
                  type="number"
                  className="form-input"
                  placeholder={t('add_student.age_placeholder')}
                  min="2"
                  max="18"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('add_student.pin')}</label>
                <input
                  id="student-pin"
                  type="text"
                  className="form-input"
                  placeholder={t('add_student.pin_placeholder')}
                  maxLength={4}
                  pattern="\d{4}"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {t('add_student.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <Loader size={18} className="spin" /> : <UserPlus size={18} />}
                <span>{t('add_student.submit')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
