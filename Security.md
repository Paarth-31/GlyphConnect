# Security Policy

**Note:** This project is complete (v1.0.0) and is no longer under active development. However, security reports will still be reviewed.

## Reporting a Vulnerability

If you find a security vulnerability in GlyphCOnnect, **please do not open a public GitHub Issue**.

Instead, email the maintainer directly with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 72 hours. If the issue is confirmed, a fix will be prioritised and a patched release will be made as soon as possible.

---

## Security Model

### What the signaling server sees

The signaling server is used only to establish WebRTC peer connections. Once the connection is established, all media (screen, audio, video), chat messages, and file transfers travel **directly between peers** and are never routed through the server.

The server stores:
- User accounts (email, bcrypt password hash, display name)
- Refresh token rows (random UUID tokens, not JWT payloads)
- Session metadata (start time, duration — no screen or audio content)

### Encryption

- **Chat messages** are encrypted end-to-end using ECDH P-256 key exchange + AES-256-GCM before entering the WebRTC data channel. The signaling server cannot decrypt them.
- **File transfers** use the WebRTC binary data channel directly — the server never receives file content.
- **Screen and audio** travel over the DTLS-encrypted WebRTC media channel.

### Passwords

All passwords are hashed with bcrypt (cost factor 12) before storage. Plaintext passwords are never logged or persisted.

### JWT Tokens

- Access tokens expire after 1 hour (configurable via `JWT_EXPIRES`)
- Refresh tokens are stored in the database and deleted on logout — they cannot be reused after logout
- The server refuses to start if `JWT_SECRET` is not set in the environment

### Electron Session

- Tokens are stored in `localStorage` and cleared from `localStorage` when the app quits via the `before-quit` hook
- The Electron `contextIsolation` is enabled and `nodeIntegration` is disabled — the renderer cannot access Node.js APIs directly
- All Node.js access goes through the `contextBridge` preload script (`backend/src/preload.ts`)

---

## Known Limitations

- TURN server credentials (`rda-turnserver.duckdns.org`) are currently hardcoded in `frontend/src/services/peer.ts`. These should be moved to environment variables and rotated periodically.
- CORS is set to `origin: '*'` on the Socket.io server — this should be restricted to known frontend origins in production.