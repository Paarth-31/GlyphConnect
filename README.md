# GlyphConnect — Remote Desktop Application

![Project Status: Complete](https://img.shields.io/badge/Project%20Status-Complete-success)

> Peer-to-peer remote desktop, screen sharing, encrypted chat, and file transfer — packaged as a cross-platform Electron app.

**Note:** This project is now considered **Complete and Stable (v1.0.0)**. All primary functionality, including the fullscreen modes, authentication fixes, code cleanup, and performance optimization, has been fully implemented.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Production Deployment](#production-deployment)
- [Security](#security)
- [Contributing](#contributing)

---

## Overview

GlyphConnect lets two users connect directly over WebRTC for:

- **Remote desktop control** — share your screen and grant full mouse/keyboard control to the other party
- **Screen sharing** — one-way or two-way screen broadcast
- **Encrypted chat** — end-to-end ECDH + AES-GCM encrypted messaging over the data channel
- **File transfer** — chunked binary transfer over a dedicated WebRTC data channel
- **Session recording** — local recording saved to the user's Videos folder

All media travels peer-to-peer via WebRTC. The signaling server is only used to establish the connection — it never sees your screen, audio, chat, or files.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron App                   │
│  ┌─────────────────┐   ┌─────────────────────┐  │
│  │  Vite / React   │   │  Electron Main      │  │
│  │  (renderer)     │   │  (backend/src)      │  │
│  │  localhost:5173 │   │  IPC bridge         │  │
│  └────────┬────────┘   └─────────────────────┘  │
└───────────┼─────────────────────────────────────┘
            │ WebRTC + Socket.io
            ▼
┌───────────────────────────┐
│   Signaling Server        │   AWS EC2 / any VPS
│   Express + Socket.io     │   Port 8080
│   localhost:8080 (dev)    │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   PostgreSQL 16           │   AWS RDS (prod)
│   Users, sessions,        │   Docker (dev)
│   refresh tokens          │
└───────────────────────────┘
```

WebRTC peers connect via a TURN server (`rda-turnserver.duckdns.org:5349`) when direct P2P is blocked by NAT or firewalls.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 28 |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3 |
| Signaling server | Node.js, Express 5, Socket.io 4 |
| Real-time comms | WebRTC (RTCPeerConnection, RTCDataChannel) |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh tokens), bcrypt, Google OAuth2 |
| Encryption | ECDH P-256 key exchange, AES-GCM, HMAC-SHA256 |
| UI components | Radix UI, Lucide React, shadcn/ui |

---

## Project Structure

```
RDA/
├── backend/                  # Electron main process
│   ├── src/
│   │   ├── main.ts           # BrowserWindow, IPC handlers, screen capture
│   │   └── preload.ts        # contextBridge — exposes electronAPI to renderer
│   └── package.json
│
├── frontend/                 # React app (Vite, runs in Electron renderer)
│   ├── src/
│   │   ├── auth/
│   │   │   └── AuthProvider.tsx   # JWT auth context + Google OAuth2
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── FileTransferPanel.tsx
│   │   │   ├── MediaControls.tsx
│   │   │   ├── RemoteScreen.tsx
│   │   │   └── layout/
│   │   ├── hooks/
│   │   │   ├── usePeerConnection.ts   # WebRTC lifecycle
│   │   │   ├── useRecording.ts        # MediaRecorder wrapper
│   │   │   └── useFileTransfer.ts
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── SessionPage.tsx
│   │   │   ├── RecordingsPage.tsx
│   │   │   ├── AddressBookPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── SignInPage.tsx
│   │   └── services/
│   │       ├── api.ts             # REST client with JWT attachment
│   │       ├── peer.ts            # RTCPeerConnection wrapper
│   │       └── messageCrypto.ts   # ECDH + AES-GCM E2E encryption
│   └── package.json
│
├── signaling-server/         # Express + Socket.io signaling + REST API
│   ├── src/
│   │   ├── server.ts
│   │   ├── events.ts              # Socket.io room + signaling events
│   │   ├── validators.ts
│   │   ├── routes/
│   │   │   ├── auth.ts            # Register, login, refresh, logout, /me
│   │   │   ├── google-auth.ts     # Google OAuth2 callback
│   │   │   ├── sessions.ts
│   │   │   ├── favourites.ts
│   │   │   ├── profile.ts
│   │   │   └── admin.ts
│   │   └── db/
│   │       ├── schema.sql         # Full PostgreSQL schema
│   │       ├── client.ts          # pg Pool
│   │       ├── users.ts
│   │       ├── sessions.ts
│   │       ├── chats.ts
│   │       ├── transcripts.ts
│   │       ├── favourites.ts
│   │       └── admin.ts
│   └── package.json
│
├── package.json              # Root — concurrently dev scripts
└── README.md
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20+ | All three packages |
| npm | 9+ | Package management |
| Docker Desktop | any | Local PostgreSQL (dev only) |
| psql | any | Running the DB schema |

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/RDA.git
cd RDA
```

### 2. Install all dependencies

```bash
npm run install:all
```

This runs `npm install` in the root, `frontend/`, `backend/`, and `signaling-server/`.

### 3. Start a local PostgreSQL database

```bash
docker run --name rda-postgres \
  -e POSTGRES_PASSWORD=localdevpassword \
  -e POSTGRES_DB=rda \
  -e POSTGRES_USER=rda_app \
  -p 5432:5432 \
  -d postgres:16
```

Then apply the schema:

```bash
PGPASSWORD=localdevpassword psql \
  -h localhost -U rda_app -d rda \
  -f signaling-server/src/db/schema.sql
```

### 4. Configure environment variables

```bash
# Signaling server
cp signaling-server/.env.example signaling-server/.env
# Edit signaling-server/.env — set JWT_SECRET (see below)

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env — set VITE_GOOGLE_CLIENT_ID if using Google login
```

Generate a secure JWT secret:

```bash
openssl rand -hex 32
```

### 5. Start everything

```bash
npm run dev
```

This starts three processes concurrently:

| Process | Command | Port |
|---|---|---|
| Signaling server | `ts-node src/server.ts` | 8080 |
| Vite dev server | `vite` | 5173 |
| Electron | waits for 5173, then launches | — |

---

## Environment Variables

### `signaling-server/.env`

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | yes | `development` or `production` |
| `PORT` | yes | HTTP port (default: `8080`) |
| `FRONTEND_URL` | yes | CORS origin (e.g. `http://localhost:5173`) |
| `DB_HOST` | yes | PostgreSQL host |
| `DB_PORT` | yes | PostgreSQL port (default: `5432`) |
| `DB_NAME` | yes | Database name |
| `DB_USER` | yes | Database user |
| `DB_PASSWORD` | yes | Database password |
| `DB_SSL` | yes | `true` for RDS, `false` for local |
| `JWT_SECRET` | **yes** | Long random string — server refuses to start without it |
| `JWT_EXPIRES` | yes | Access token lifetime (e.g. `1h`) |
| `GOOGLE_CLIENT_ID` | if using Google login | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | if using Google login | From Google Cloud Console |

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_SERVER_URL` | yes | Signaling server URL (e.g. `http://localhost:8080`) |
| `VITE_GOOGLE_CLIENT_ID` | if using Google login | Same client ID as backend |

---

## Running the App

### Development (all three in parallel)

```bash
npm run dev
```

### Individual services

```bash
npm run dev:signaling   # signaling server only
npm run dev:frontend    # Vite dev server only
npm run dev:desktop     # Electron only (requires Vite already running)
```

### Build Electron for distribution

```bash
cd backend && npm run build   # compiles TypeScript
cd frontend && npm run build  # builds Vite output
```

---

## Production Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full AWS EC2 setup, PM2 configuration, and update procedures.

Quick summary:

```bash
# On the EC2 instance
git pull origin main
cd signaling-server && npm install
npm run build          # if you add a build step
pm2 restart rda-signaling
```

---

## Security

- **Tokens cleared on exit** — Electron wipes `localStorage` tokens via `before-quit` so the app does not stay logged in across restarts
- **JWT secret required** — the server will not start if `JWT_SECRET` is missing or empty
- **End-to-end encryption** — chat messages are encrypted with ECDH P-256 + AES-256-GCM before entering the WebRTC data channel; the signaling server cannot read them
- **File transfer** — files are sent directly peer-to-peer via the binary data channel; they never touch the server
- **Password hashing** — bcrypt with cost factor 12
- **Refresh token rotation** — refresh tokens are stored in the database; logout deletes the row so the token can never be reused
- **Rate limiting** — Socket.io connections are rate-limited per IP at the signaling layer

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/)
4. Push and open a Pull Request

Please do not commit `.env` files, compiled `dist/` output, or any `*.zip` archives.