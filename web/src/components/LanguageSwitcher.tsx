import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';
import '../index.css';

export default function LanguageSwitcher() {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      className="lang-switcher"
      onClick={toggleLang}
      title={lang === 'ru' ? 'Қазақша' : 'Русский'}
    >
      <Globe size={16} />
      <span>{lang === 'ru' ? 'Қазақша' : 'Русский'}</span>
    </button>
  );
}