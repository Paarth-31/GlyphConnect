// // // frontend/src/services/api.ts
// // //
// // // FIX: The old fallback was 'http://localhost:8080'.
// // // When the app is served from GitHub Pages (HTTPS), Chrome's
// // // "Private Network Access" policy hard-blocks any fetch from a
// // // public HTTPS origin to a loopback address — that's the
// // // "Permission was denied for this request to access the loopback
// // // address space" error you saw.
// // //
// // // Fix: fallback is now the production signaling server URL.
// // // For local dev, create frontend/.env with:
// // //   VITE_SERVER_URL=http://localhost:8080

// // const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// // // ── Token helpers ─────────────────────────────────────────────────────────

// // export function getToken(): string | null {
// //   return localStorage.getItem('rda_access_token');
// // }

// // export function setTokens(accessToken: string, refreshToken: string) {
// //   localStorage.setItem('rda_access_token', accessToken);
// //   localStorage.setItem('rda_refresh_token', refreshToken);
// // }

// // export function clearTokens() {
// //   localStorage.removeItem('rda_access_token');
// //   localStorage.removeItem('rda_refresh_token');
// // }

// // export function isLoggedIn(): boolean {
// //   return !!getToken();
// // }

// // // ── Core fetch ────────────────────────────────────────────────────────────

// // async function request<T>(method: string, path: string, body?: object): Promise<T> {
// //   const token = getToken();
// //   const headers: Record<string, string> = { 'Content-Type': 'application/json' };
// //   if (token) headers['Authorization'] = `Bearer ${token}`;

// //   const res = await fetch(`${SERVER_URL}${path}`, {
// //     method,
// //     headers,
// //     body: body ? JSON.stringify(body) : undefined,
// //   });

// //   if (!res.ok) {
// //     const text = await res.text();
// //     let msg = res.statusText;
// //     try { msg = JSON.parse(text).error ?? msg; } catch { msg = text || msg; }
// //     throw new Error(msg);
// //   }

// //   if (res.status === 204) return {} as T;

// //   const text = await res.text();
// //   try { return JSON.parse(text) as T; }
// //   catch { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`); }
// // }

// // const get   = <T>(path: string)              => request<T>('GET',    path);
// // const post  = <T>(path: string, body: object) => request<T>('POST',   path, body);
// // const patch = <T>(path: string, body: object) => request<T>('PATCH',  path, body);
// // const del   = <T>(path: string)              => request<T>('DELETE', path);

// // // ── Auth ──────────────────────────────────────────────────────────────────

// // export interface AuthUser {
// //   id: string;
// //   email: string;
// //   display_name: string;
// //   avatar_url: string | null;
// //   role: string;
// //   is_verified: boolean;
// //   two_fa_enabled: boolean;
// //   created_at: string;
// // }

// // export interface AuthResponse {
// //   user: AuthUser;
// //   accessToken: string;
// //   refreshToken: string;
// // }

// // export const authApi = {
// //   register: (email: string, password: string, displayName: string) =>
// //     post<AuthResponse>('/auth/register', { email, password, displayName }),

// //   login: (email: string, password: string) =>
// //     post<AuthResponse>('/auth/login', { email, password }),

// //   refresh: (refreshToken: string) =>
// //     post<{ accessToken: string }>('/auth/refresh', { refreshToken }),

// //   logout: (refreshToken: string) =>
// //     post<{ ok: boolean }>('/auth/logout', { refreshToken }),

// //   me: () => get<AuthUser>('/auth/me'),

// //   changePassword: (currentPassword: string, newPassword: string) =>
// //     patch<{ ok: boolean }>('/auth/password', { currentPassword, newPassword }),
// // };

// // // ── Profile ───────────────────────────────────────────────────────────────

// // export interface UserProfile {
// //   id: string;
// //   email: string;
// //   display_name: string;
// //   avatar_url: string | null;
// //   role: string;
// //   full_name: string | null;
// //   bio: string | null;
// //   timezone: string | null;
// //   locale: string | null;
// //   preferred_lang: string | null;
// //   phone: string | null;
// //   country_code: string | null;
// //   two_fa_enabled: boolean;
// // }

// // export interface UserStats {
// //   total_sessions: number;
// //   total_duration_seconds: number;
// //   avg_duration_seconds: number;
// //   last_session_at: string | null;
// //   sessions_today: number;
// // }

// // export const profileApi = {
// //   get:    ()                         => get<UserProfile>('/auth/me'),
// //   update: (u: Partial<UserProfile>)  => patch<UserProfile>('/profile', u),
// //   stats:  ()                         => get<UserStats>('/profile/stats'),
// // };

// // // ── Sessions ──────────────────────────────────────────────────────────────

// // export interface Session {
// //   id: string;
// //   host_display_id: string;
// //   controller_id: string | null;
// //   controller_name: string | null;
// //   status: string;
// //   start_time: string;
// //   end_time: string | null;
// //   duration_seconds: number | null;
// //   screen_audio: boolean;
// //   video_call: boolean;
// //   control_enabled: boolean;
// //   summary: string | null;
// //   ai_summary: string | null;
// // }

// // export const sessionsApi = {
// //   list:   (limit = 20) => get<Session[]>(`/sessions?limit=${limit}`),
// //   get:    (id: string) => get<Session>(`/sessions/${id}`),
// //   create: (data: {
// //     hostDisplayId: string;
// //     screenAudio?: boolean;
// //     videoCall?: boolean;
// //     controlEnabled?: boolean;
// //   }) => post<Session>('/sessions', data),
// //   end: (id: string, summary?: string, stats?: object) =>
// //     patch<Session>(`/sessions/${id}/end`, { summary, stats }),
// // };

// // // ── Favourites ────────────────────────────────────────────────────────────

// // export interface Favourite {
// //   id: string;
// //   remote_id: string;
// //   label: string | null;
// //   last_used_at: string | null;
// //   use_count: number;
// //   created_at: string;
// // }

// // export const favouritesApi = {
// //   list:   ()                                   => get<Favourite[]>('/favourites'),
// //   upsert: (remoteId: string, label?: string)   => post<Favourite>('/favourites', { remoteId, label }),
// //   delete: (id: string)                         => del<{ ok: boolean }>(`/favourites/${id}`),
// // };

// // // ── Recordings (Electron IPC only) ────────────────────────────────────────

// // export interface RecordingFile {
// //   id: string;
// //   name: string;
// //   path: string;
// //   size: number;
// //   duration: number;
// //   createdAt: string;
// // }

// // export const recordingsApi = {
// //   list: (): Promise<RecordingFile[]> => {
// //     const api = (window as any).electronAPI;
// //     if (!api?.listRecordings) return Promise.resolve([]);
// //     return api.listRecordings().catch(() => []);
// //   },
// //   play:   (p: string) => (window as any).electronAPI?.openFile?.(p),
// //   export: (p: string) => (window as any).electronAPI?.exportRecording?.(p),
// //   delete: (p: string): Promise<boolean> =>
// //     (window as any).electronAPI?.deleteRecording?.(p) ?? Promise.resolve(false),
// // };



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
//   list:   ()                                              => get<Favourite[]>('/favourites'),
//   /** Add a new contact or update its label. Does NOT increment use_count. */
//   upsert: (remoteId: string, label?: string)              => post<Favourite>('/favourites', { remoteId, label }),
//   /** Call this when actually connecting — bumps use_count + last_used_at. */
//   bump:   (remoteId: string)                              => post<Favourite>('/favourites', { remoteId, bump: true }),
//   delete: (id: string)                                    => del<{ ok: boolean }>(`/favourites/${id}`),
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
// CHANGES:
// [SESSION-DB] sessionsApi.create() now includes controllerSocketId so the
//   server can record it. sessionsApi.end() sends duration stats.
// [FAV] favouritesApi.bump() explicitly calls upsert with bump:true so
//   use_count increments and last_used_at updates on every connect.
// [PERM-ID] profileApi.getRoomId() / setRoomId() — authenticated users can
//   sync their permanent room ID to the DB so it survives device changes.
// [URL] Fallback is now https:// not http://localhost so GitHub Pages works.

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
export function isLoggedIn(): boolean { return !!getToken(); }

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

const get    = <T>(path: string)               => request<T>('GET',    path);
const post   = <T>(path: string, body: object) => request<T>('POST',   path, body);
const patch  = <T>(path: string, body: object) => request<T>('PATCH',  path, body);
const put    = <T>(path: string, body: object) => request<T>('PUT',    path, body);
const del    = <T>(path: string)               => request<T>('DELETE', path);

// ── Auth ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;     // NOTE: display_name not name
  avatar_url: string | null;
  role: string;
  is_verified: boolean;
  two_fa_enabled: boolean;
  permanent_room_id: string | null;
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
  permanent_room_id: string | null;
}

export interface UserStats {
  total_sessions: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  last_session_at: string | null;
  sessions_today: number;
}

export const profileApi = {
  get: () => get<UserProfile>('/auth/me'),
  update: (u: Partial<UserProfile>) => patch<UserProfile>('/profile', u),
  stats: () => get<UserStats>('/profile/stats'),

  /** Get this user's permanent room ID from the DB */
  getRoomId: () =>
    get<{ permanent_room_id: string | null }>('/profile/room-id'),

  /** Sync a permanent room ID to the DB (e.g. after generating one locally) */
  setRoomId: (roomId: string) =>
    put<{ permanent_room_id: string }>('/profile/room-id', { roomId }),
};

// ── Sessions ──────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  host_display_id: string;
  controller_socket_id: string | null;
  controller_name: string | null;
  favourite_id?: string | null;
  status: 'active' | 'ended' | 'error';
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
  list: (limit = 20) =>
    get<Session[]>(`/sessions?limit=${limit}`),

  get: (id: string) =>
    get<Session>(`/sessions/${id}`),

  /** Call this when a session is established (ICE connected) */
  create: (data: {
    hostDisplayId: string;
    controllerSocketId?: string;
    screenAudio?: boolean;
    videoCall?: boolean;
    controlEnabled?: boolean;
  }) =>
    post<Session>('/sessions', {
      hostDisplayId:      data.hostDisplayId,
      controllerSocketId: data.controllerSocketId,
      screenAudio:        data.screenAudio   ?? false,
      videoCall:          data.videoCall     ?? false,
      controlEnabled:     data.controlEnabled ?? false,
    }),

  /** Call this when the session ends (End button or hang-up) */
  end: (id: string, opts?: { summary?: string; videoCall?: boolean; controlEnabled?: boolean }) =>
    patch<Session>(`/sessions/${id}/end`, {
      summary:        opts?.summary,
      videoCall:      opts?.videoCall,
      controlEnabled: opts?.controlEnabled,
    }),
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
  list: () =>
    get<Favourite[]>('/favourites'),

  /** Add or update a favourite. Pass label to set/update a display name. */
  upsert: (remoteId: string, label?: string) =>
    post<Favourite>('/favourites', { remoteId, label }),

  /** Increment use_count and update last_used_at for an existing entry.
   *  Creates the entry if it doesn't exist yet. */
  bump: (remoteId: string) =>
    post<Favourite>('/favourites', { remoteId, bump: true }),

  delete: (id: string) =>
    del<{ ok: boolean }>(`/favourites/${id}`),
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