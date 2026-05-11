import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Language } from '../i18n/translations';
import { t as translate } from '../i18n/translations';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('ru');

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState(prev => prev === 'ru' ? 'kk' : 'ru');
  }, []);

  const tFn = useCallback((key: string, params?: Record<string, string | number>) => {
    return translate(lang, key, params);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export type { Language } from '../i18n/translations';