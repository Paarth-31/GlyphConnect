# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

- No active development. Project is complete.

### Fixed

- **Fullscreen Toggle** — Added native IPC integration to cleanly toggle Electron fullscreen modes and sync UI state.
- **Sign Out Flow** — Fixed a development bug on the Profile page that used `window.location.reload()` instead of proper `logout` context handling.
- **Codebase Comments** — Stripped noisy inline JSX/TS comments and replaced them with high-level functional file markers.
- **Directory Clean-up** — Removed all stale `.cache`, `dist`, and `out` build outputs from the previous development cycle.

- **Electron always logged in on restart** — `before-quit` hook now clears `rda_access_token` and `rda_refresh_token` from `localStorage` before the app exits
- **DBus noise on Linux** — `app.commandLine` flags (`no-sandbox`, `disable-dev-shm-usage`) suppress the `org.freedesktop.DBus.StartServiceByName` error that appeared on minimal Linux desktops
- **ipcMain double-registration on macOS** — all `ipcMain.handle` and `ipcMain.on` calls moved to module level; previously they were inside `createWindow()` and would re-register on the macOS `activate` event
- **401 on `/auth/me` at startup** — stale tokens are now handled cleanly: tries refresh token, then clears storage and shows login screen if both fail
- **Google login spinner** — `isGoogleLoading` is now exposed in `AuthContext` so `SignInPage` can show a spinner on the Google button while OAuth is in progress
- **JWT secret silent fallback** — signaling server now throws at startup if `JWT_SECRET` is not set, instead of silently using the weak default `change-me-in-production`

### Changed

- `JWT_EXPIRES` default in `.env.example` changed from `15m` to `1h` to reduce unnecessary token refreshes during development

---

## [1.0.0] — Initial release

### Added

- Electron desktop app wrapping a Vite + React frontend
- WebRTC peer-to-peer screen sharing and remote desktop control
- End-to-end encrypted chat (ECDH P-256 + AES-256-GCM)
- Binary file transfer over WebRTC data channel
- Session recording saved to local Videos folder
- JWT authentication with access + refresh token rotation
- Google OAuth2 sign-in (Electron and browser)
- Address book / favourites with recent sessions
- Admin dashboard (user management, session logs, system health)
- PostgreSQL schema with users, sessions, refresh tokens, profiles, and audit logs
- Socket.io signaling server with ICE candidate relay and room management
- TURN server integration for NAT traversal