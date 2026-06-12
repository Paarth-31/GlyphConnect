import React, {
  createContext, useContext, useEffect,
  useState, useRef, useCallback
} from 'react';
import { authApi, setTokens, clearTokens, getToken } from '../services/api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  is_verified: boolean;
  two_fa_enabled: boolean;
  created_at: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => void;
  getToken: () => string | null;
  error: string | null;
  clearError: () => void;
  // 2FA login flow
  needs2FA: boolean;
  verify2FALogin: (code: string) => Promise<void>;
  cancel2FA: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: () => {},
  logout: () => {},
  getToken: () => null,
  error: null,
  clearError: () => {},
  needs2FA: false,
  verify2FALogin: async () => {},
  cancel2FA: () => {},
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading]             = useState(true);
  const [user, setUser]                       = useState<AuthUser | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA]       = useState(false);
  const [tempToken2FA, setTempToken]  = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi.me()
      .then((u) => {
    setUser(u as AuthUser);
    setIsAuthenticated(true);
  })
      .catch(async () => {
        const rt = localStorage.getItem('rda_refresh_token');
        if (rt) {
          try {
            const { accessToken } = await authApi.refresh(rt);
            setTokens(accessToken, rt);
            const u = await authApi.me();
            setUser(u as AuthUser);
            setIsAuthenticated(true);
          } catch {
            clearTokens();
          }
        } else {
          clearTokens();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshTimerRef.current = setInterval(async () => {
      const rt = localStorage.getItem('rda_refresh_token');
      if (!rt) return;
      try {
        const { accessToken } = await authApi.refresh(rt);
        setTokens(accessToken, rt);
      } catch {
        doLogout();
      }
    }, 12 * 60 * 1000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || state !== 'google_oauth') return;

    window.history.replaceState({}, document.title, window.location.pathname);

    fetch(`${SERVER_URL}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setTokens(data.accessToken, data.refreshToken);
        setUser(data.user as AuthUser);
        setIsAuthenticated(true);
      })
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const res: any = await authApi.login(email, password).catch(e => {
      setError(e.message ?? 'Login failed');
      throw e;
    });

    if (res.requires2FA) {
      setTempToken(res.tempToken);
      setNeeds2FA(true);
      return;
    }

    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user as AuthUser);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (
    email: string, password: string, displayName: string
  ) => {
    setError(null);
    const res = await authApi.register(email, password, displayName).catch(e => {
      setError(e.message ?? 'Registration failed');
      throw e;
    });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user as AuthUser);
    setIsAuthenticated(true);
  }, []);

  const loginWithGoogle = useCallback(async () => {
  if (!GOOGLE_CLIENT_ID) {
    setError('Google login not configured. Set VITE_GOOGLE_CLIENT_ID in .env');
    return;
  }

  const isElectron = !!(window as any).electronAPI;

  const redirectUri = isElectron
    ? 'http://localhost:5174'
    : window.location.origin;

  const url =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&state=google_oauth` +
    `&access_type=offline` +
    `&prompt=select_account`;

  if (isElectron) {
    setLoading(true);
    try {
      const code = await (window as any).electronAPI.startGoogleOAuth(url);
      const res = await fetch(`${SERVER_URL}/auth/google/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: 'http://localhost:5174' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user as AuthUser);
      setIsAuthenticated(true);
    } catch (e: any) {
      setError(e.message ?? 'Google login failed');
    } finally {
      setLoading(false);
    }
  } else {
    window.location.href = url;
  }
}, []);

  const doLogout = useCallback(() => {
    const rt = localStorage.getItem('rda_refresh_token');
    if (rt) authApi.logout(rt).catch(() => {});
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    setNeeds2FA(false);
    setTempToken(null);
  }, []);

  const verify2FALogin = useCallback(async (code: string) => {
    if (!tempToken2FA) {
      setError('No 2FA session. Please log in again.');
      return;
    }
    setError(null);
    try {
      const res = await authApi.login2FA(tempToken2FA, code);
      setTokens(res.accessToken, res.refreshToken);
      setUser(res.user as AuthUser);
      setIsAuthenticated(true);
      setNeeds2FA(false);
      setTempToken(null);
    } catch (e: any) {
      setError(e.message ?? 'Invalid authentication code');
      throw e;
    }
  }, [tempToken2FA]);

  const cancel2FA = useCallback(() => {
    setNeeds2FA(false);
    setTempToken(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, user,
      login, register, loginWithGoogle,
      logout: doLogout,
      getToken,
      error, clearError,
      needs2FA, verify2FALogin, cancel2FA,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}