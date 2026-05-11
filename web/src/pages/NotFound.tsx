import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Home } from 'lucide-react';
import '../index.css';

function NotFound() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-code">{t('notfound.code')}</h1>
        <h2>{t('notfound.title')}</h2>
        <p>{t('notfound.message')}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <Home size={20} />
          <span>{t('app.home')}</span>
        </button>
      </div>
    </div>
  );
}

export default NotFound;