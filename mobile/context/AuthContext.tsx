import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginWithPhone, getCurrentUser, type User } from '@/services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (phoneOrEmail: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('authUser'),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // Validate token in background
          getCurrentUser()
            .then(data => {
              setUser(data.user);
              AsyncStorage.setItem('authUser', JSON.stringify(data.user));
            })
            .catch(() => {
              AsyncStorage.removeItem('authToken');
              AsyncStorage.removeItem('authUser');
              setToken(null);
              setUser(null);
            });
        }
      } catch { /* ignore parse errors */ }
      finally { setLoading(false); }
    })();
  }, []);

  const _save = async (data: any): Promise<User> => {
    await AsyncStorage.setItem('authToken', data.access_token);
    await AsyncStorage.setItem('authUser', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    setError(null);
    return data.user;
  };

  const login = useCallback(async (phoneOrEmail: string, password: string): Promise<User> => {
    setLoading(true); setError(null);
    try {
      return await _save(await loginWithPhone(phoneOrEmail, password));
    } catch (err: any) {
      const msg = err.message || 'Неверный номер телефона или пароль';
      setError(msg); throw err;
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    AsyncStorage.removeItem('authToken');
    AsyncStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
