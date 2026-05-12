import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { loginWithEmail, loginWithPin, getCurrentUser, type User } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (pinCode: string) => Promise<User>;
  loginEmail: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem('authUser');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-validate token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token || user) return;
    void (async () => {
      setIsLoading(true);
      try {
        const data = await getCurrentUser();
        setUser(data.user);
        localStorage.setItem('authUser', JSON.stringify(data.user));
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        setUser(null);
      } finally { setIsLoading(false); }
    })();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const _saveSession = (data: any): User => {
    localStorage.setItem('authToken', data.access_token);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    setUser(data.user);
    setError(null);
    return data.user;
  };

  const login = useCallback(async (pinCode: string): Promise<User> => {
    setIsLoading(true); setError(null);
    try {
      return _saveSession(await loginWithPin(pinCode));
    } catch (err: any) {
      const msg = err.message || 'Неверный PIN-код';
      setError(msg); throw err;
    } finally { setIsLoading(false); }
  }, []);

  const loginEmail = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true); setError(null);
    try {
      return _saveSession(await loginWithEmail(email, password));
    } catch (err: any) {
      const msg = err.message || 'Неверный email или пароль';
      setError(msg); throw err;
    } finally { setIsLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setUser(null); setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, loginEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}