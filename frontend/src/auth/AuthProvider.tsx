import React, {
  createContext, useContext, useEffect,
  useState, useRef, useCallback
} from 'react';
import { authApi, setTokens, clearTokens, getToken } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
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
}

// ── Context ───────────────────────────────────────────────────────────────

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
});

// ── Google OAuth2 config ──────────────────────────────────────────────────
// Set these in frontend/.env:
//   VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
//   VITE_SERVER_URL=http://localhost:8080

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';

// ── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading]             = useState(true);
  const [user, setUser]                       = useState<AuthUser | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(false);
// Add to context value and type if you want to show a spinner

  // ── On mount: restore session from localStorage ───────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Token exists — verify it is still valid by fetching /auth/me
    authApi.me()
      .then((u) => {
    setUser(u as AuthUser);
    setIsAuthenticated(true);
  })
      .catch(async () => {
        // Try refresh token before giving up
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

  // ── Auto-refresh access token every 12 minutes ────────────────────────

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

  // ── Google OAuth2 callback handler ────────────────────────────────────
  // When Google redirects back with ?code=..., exchange it server-side

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || state !== 'google_oauth') return;

    // Remove the query params from URL immediately
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

  // ── Actions ───────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const res = await authApi.login(email, password).catch(e => {
      setError(e.message ?? 'Login failed');
      throw e;
    });
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

  // Redirect to Google's consent screen
  const loginWithGoogle = useCallback(async () => {
  if (!GOOGLE_CLIENT_ID) {
    setError('Google login not configured. Set VITE_GOOGLE_CLIENT_ID in .env');
    return;
  }

  const isElectron = !!(window as any).electronAPI;

  // Build the OAuth URL — redirect_uri points to our local callback server
  const redirectUri = isElectron
    ? 'http://localhost:5174'      // caught by Electron's local HTTP server
    : window.location.origin;      // browser: caught by AuthProvider useEffect

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
      // Exchange code server-side
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
    // Browser: just redirect, AuthProvider useEffect handles the callback
    window.location.href = url;
  }
}, []);

  const doLogout = useCallback(() => {
    const rt = localStorage.getItem('rda_refresh_token');
    if (rt) authApi.logout(rt).catch(() => {});
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, user,
      login, register, loginWithGoogle,
      logout: doLogout,
      getToken,
      error, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}