// // frontend/src/services/api.ts
// //
// // FIX: The old fallback was 'http://localhost:8080'.
// // When the app is served from GitHub Pages (HTTPS), Chrome's
// // "Private Network Access" policy hard-blocks any fetch from a
// // public HTTPS origin to a loopback address — that's the
// // "Permission was denied for this request to access the loopback
// // address space" error you saw.
// //
// // Fix: fallback is now the production signaling server URL.
// // For local dev, create frontend/.env with:
// //   VITE_SERVER_URL=http://localhost:8080

// const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// // ── Token helpers ─────────────────────────────────────────────────────────

// export function getToken(): string | null {
//   return localStorage.getItem('rda_access_token');
// }

// export function setTokens(accessToken: string, refreshToken: string) {
//   localStorage.setItem('rda_access_token', accessToken);
//   localStorage.setItem('rda_refresh_token', refreshToken);
// }

// export function clearTokens() {
//   localStorage.removeItem('rda_access_token');
//   localStorage.removeItem('rda_refresh_token');
// }

// export function isLoggedIn(): boolean {
//   return !!getToken();
// }

// // ── Core fetch ────────────────────────────────────────────────────────────

// async function request<T>(method: string, path: string, body?: object): Promise<T> {
//   const token = getToken();
//   const headers: Record<string, string> = { 'Content-Type': 'application/json' };
//   if (token) headers['Authorization'] = `Bearer ${token}`;

//   const res = await fetch(`${SERVER_URL}${path}`, {
//     method,
//     headers,
//     body: body ? JSON.stringify(body) : undefined,
//   });

//   if (!res.ok) {
//     const text = await res.text();
//     let msg = res.statusText;
//     try { msg = JSON.parse(text).error ?? msg; } catch { msg = text || msg; }
//     throw new Error(msg);
//   }

//   if (res.status === 204) return {} as T;

//   const text = await res.text();
//   try { return JSON.parse(text) as T; }
//   catch { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`); }
// }

// const get   = <T>(path: string)              => request<T>('GET',    path);
// const post  = <T>(path: string, body: object) => request<T>('POST',   path, body);
// const patch = <T>(path: string, body: object) => request<T>('PATCH',  path, body);
// const del   = <T>(path: string)              => request<T>('DELETE', path);

// // ── Auth ──────────────────────────────────────────────────────────────────

// export interface AuthUser {
//   id: string;
//   email: string;
//   display_name: string;
//   avatar_url: string | null;
//   role: string;
//   is_verified: boolean;
//   two_fa_enabled: boolean;
//   created_at: string;
// }

// export interface AuthResponse {
//   user: AuthUser;
//   accessToken: string;
//   refreshToken: string;
// }

// export const authApi = {
//   register: (email: string, password: string, displayName: string) =>
//     post<AuthResponse>('/auth/register', { email, password, displayName }),

//   login: (email: string, password: string) =>
//     post<AuthResponse>('/auth/login', { email, password }),

//   refresh: (refreshToken: string) =>
//     post<{ accessToken: string }>('/auth/refresh', { refreshToken }),

//   logout: (refreshToken: string) =>
//     post<{ ok: boolean }>('/auth/logout', { refreshToken }),

//   me: () => get<AuthUser>('/auth/me'),

//   changePassword: (currentPassword: string, newPassword: string) =>
//     patch<{ ok: boolean }>('/auth/password', { currentPassword, newPassword }),
// };

// // ── Profile ───────────────────────────────────────────────────────────────

// export interface UserProfile {
//   id: string;
//   email: string;
//   display_name: string;
//   avatar_url: string | null;
//   role: string;
//   full_name: string | null;
//   bio: string | null;
//   timezone: string | null;
//   locale: string | null;
//   preferred_lang: string | null;
//   phone: string | null;
//   country_code: string | null;
//   two_fa_enabled: boolean;
// }

// export interface UserStats {
//   total_sessions: number;
//   total_duration_seconds: number;
//   avg_duration_seconds: number;
//   last_session_at: string | null;
//   sessions_today: number;
// }

// export const profileApi = {
//   get:    ()                         => get<UserProfile>('/auth/me'),
//   update: (u: Partial<UserProfile>)  => patch<UserProfile>('/profile', u),
//   stats:  ()                         => get<UserStats>('/profile/stats'),
// };

// // ── Sessions ──────────────────────────────────────────────────────────────

// export interface Session {
//   id: string;
//   host_display_id: string;
//   controller_id: string | null;
//   controller_name: string | null;
//   status: string;
//   start_time: string;
//   end_time: string | null;
//   duration_seconds: number | null;
//   screen_audio: boolean;
//   video_call: boolean;
//   control_enabled: boolean;
//   summary: string | null;
//   ai_summary: string | null;
// }

// export const sessionsApi = {
//   list:   (limit = 20) => get<Session[]>(`/sessions?limit=${limit}`),
//   get:    (id: string) => get<Session>(`/sessions/${id}`),
//   create: (data: {
//     hostDisplayId: string;
//     screenAudio?: boolean;
//     videoCall?: boolean;
//     controlEnabled?: boolean;
//   }) => post<Session>('/sessions', data),
//   end: (id: string, summary?: string, stats?: object) =>
//     patch<Session>(`/sessions/${id}/end`, { summary, stats }),
// };

// // ── Favourites ────────────────────────────────────────────────────────────

// export interface Favourite {
//   id: string;
//   remote_id: string;
//   label: string | null;
//   last_used_at: string | null;
//   use_count: number;
//   created_at: string;
// }

// export const favouritesApi = {
//   list:   ()                                   => get<Favourite[]>('/favourites'),
//   upsert: (remoteId: string, label?: string)   => post<Favourite>('/favourites', { remoteId, label }),
//   delete: (id: string)                         => del<{ ok: boolean }>(`/favourites/${id}`),
// };

// // ── Recordings (Electron IPC only) ────────────────────────────────────────

// export interface RecordingFile {
//   id: string;
//   name: string;
//   path: string;
//   size: number;
//   duration: number;
//   createdAt: string;
// }

// export const recordingsApi = {
//   list: (): Promise<RecordingFile[]> => {
//     const api = (window as any).electronAPI;
//     if (!api?.listRecordings) return Promise.resolve([]);
//     return api.listRecordings().catch(() => []);
//   },
//   play:   (p: string) => (window as any).electronAPI?.openFile?.(p),
//   export: (p: string) => (window as any).electronAPI?.exportRecording?.(p),
//   delete: (p: string): Promise<boolean> =>
//     (window as any).electronAPI?.deleteRecording?.(p) ?? Promise.resolve(false),
// };



// frontend/src/services/api.ts
//
// FIX: The old fallback was 'http://localhost:8080'.
// When the app is served from GitHub Pages (HTTPS), Chrome's
// "Private Network Access" policy hard-blocks any fetch from a
// public HTTPS origin to a loopback address — that's the
// "Permission was denied for this request to access the loopback
// address space" error you saw.
//
// Fix: fallback is now the production signaling server URL.
// For local dev, create frontend/.env with:
//   VITE_SERVER_URL=http://localhost:8080

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// ── Token helpers ─────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('rda_access_token');
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('rda_access_token', accessToken);
  localStorage.setItem('rda_refresh_token', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('rda_access_token');
  localStorage.removeItem('rda_refresh_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ── Core fetch ────────────────────────────────────────────────────────────

async function request<T>(method: string, path: string, body?: object): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try { msg = JSON.parse(text).error ?? msg; } catch { msg = text || msg; }
    throw new Error(msg);
  }

  if (res.status === 204) return {} as T;

  const text = await res.text();
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`); }
}

const get   = <T>(path: string)              => request<T>('GET',    path);
const post  = <T>(path: string, body: object) => request<T>('POST',   path, body);
const patch = <T>(path: string, body: object) => request<T>('PATCH',  path, body);
const del   = <T>(path: string)              => request<T>('DELETE', path);

// ── Auth ──────────────────────────────────────────────────────────────────

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

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  register: (email: string, password: string, displayName: string) =>
    post<AuthResponse>('/auth/register', { email, password, displayName }),

  login: (email: string, password: string) =>
    post<AuthResponse>('/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    post<{ accessToken: string }>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    post<{ ok: boolean }>('/auth/logout', { refreshToken }),

  me: () => get<AuthUser>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    patch<{ ok: boolean }>('/auth/password', { currentPassword, newPassword }),
};

// ── Profile ───────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  full_name: string | null;
  bio: string | null;
  timezone: string | null;
  locale: string | null;
  preferred_lang: string | null;
  phone: string | null;
  country_code: string | null;
  two_fa_enabled: boolean;
}

export interface UserStats {
  total_sessions: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  last_session_at: string | null;
  sessions_today: number;
}

export const profileApi = {
  get:    ()                         => get<UserProfile>('/auth/me'),
  update: (u: Partial<UserProfile>)  => patch<UserProfile>('/profile', u),
  stats:  ()                         => get<UserStats>('/profile/stats'),
};

// ── Sessions ──────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  host_display_id: string;
  controller_id: string | null;
  controller_name: string | null;
  status: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  screen_audio: boolean;
  video_call: boolean;
  control_enabled: boolean;
  summary: string | null;
  ai_summary: string | null;
}

export const sessionsApi = {
  list:   (limit = 20) => get<Session[]>(`/sessions?limit=${limit}`),
  get:    (id: string) => get<Session>(`/sessions/${id}`),
  create: (data: {
    hostDisplayId: string;
    screenAudio?: boolean;
    videoCall?: boolean;
    controlEnabled?: boolean;
  }) => post<Session>('/sessions', data),
  end: (id: string, summary?: string, stats?: object) =>
    patch<Session>(`/sessions/${id}/end`, { summary, stats }),
};

// ── Favourites ────────────────────────────────────────────────────────────

export interface Favourite {
  id: string;
  remote_id: string;
  label: string | null;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
}

export const favouritesApi = {
  list:   ()                                              => get<Favourite[]>('/favourites'),
  /** Add a new contact or update its label. Does NOT increment use_count. */
  upsert: (remoteId: string, label?: string)              => post<Favourite>('/favourites', { remoteId, label }),
  /** Call this when actually connecting — bumps use_count + last_used_at. */
  bump:   (remoteId: string)                              => post<Favourite>('/favourites', { remoteId, bump: true }),
  delete: (id: string)                                    => del<{ ok: boolean }>(`/favourites/${id}`),
};

// ── Recordings (Electron IPC only) ────────────────────────────────────────

export interface RecordingFile {
  id: string;
  name: string;
  path: string;
  size: number;
  duration: number;
  createdAt: string;
}

export const recordingsApi = {
  list: (): Promise<RecordingFile[]> => {
    const api = (window as any).electronAPI;
    if (!api?.listRecordings) return Promise.resolve([]);
    return api.listRecordings().catch(() => []);
  },
  play:   (p: string) => (window as any).electronAPI?.openFile?.(p),
  export: (p: string) => (window as any).electronAPI?.exportRecording?.(p),
  delete: (p: string): Promise<boolean> =>
    (window as any).electronAPI?.deleteRecording?.(p) ?? Promise.resolve(false),
};