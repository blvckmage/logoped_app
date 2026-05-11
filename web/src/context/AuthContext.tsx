import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { authByPin, getCurrentUser } from '../services/api';

interface User {
  id: number;
  name: string;
  role: 'child' | 'parent' | 'therapist';
  pin_code: string | null;
  email: string | null;
  parent_id: number | null;
  therapist_id: number | null;
  age: number | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (pinCode: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('authUser');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
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
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const login = useCallback(async (pinCode: string): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authByPin(pinCode);
      localStorage.setItem('authToken', data.access_token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const message = err.message || 'Неверный PIN-код';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}