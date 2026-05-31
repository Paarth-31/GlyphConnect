// // import 'dotenv/config';
// // import http from 'http';
// // import { Server } from 'socket.io';
// // import express, { Request, Response } from 'express';
// // import cors from 'cors';
// // import { setupSocketEvents } from './events';
// // import { getPoolStats } from './db/client';
// // import { recordSystemHealth } from './db/admin';
// // import authRouter from './routes/auth';
// // import googleAuthRouter from './routes/google-auth';
// // import sessionsRouter from './routes/sessions';
// // import adminRouter from './routes/admin';
// // import favouritesRouter from './routes/favourites';
// // import profileRouter from './routes/profile';

// // const PORT = parseInt(process.env.PORT ?? '8080');

// // async function bootstrap() {
// //   const app = express();

// //   // ── CORS — allow frontend origin ──────────────────────────────────────────
// //   const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
// //   app.use(cors({
// //     origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
// //     credentials: true,
// //   }));

// //   app.use(express.json({ limit: '2mb' }));
// //   app.use(express.urlencoded({ extended: true }));

// //   // ── REST routes ───────────────────────────────────────────────────────────
// //   app.use('/auth',       authRouter);
// //   app.use('/auth',       googleAuthRouter);   // ← Google OAuth2 (POST /auth/google/callback)
// //   app.use('/sessions',   sessionsRouter);
// //   app.use('/admin',      adminRouter);
// //   app.use('/favourites', favouritesRouter);
// //   app.use('/profile',    profileRouter);

// //   // ── Health check ──────────────────────────────────────────────────────────
// //   app.get('/health', async (_req: Request, res: Response) => {
// //     try {
// //       const stats = await getPoolStats();
// //       res.json({ status: 'ok', db_pool: stats, ts: new Date().toISOString() });
// //     } catch {
// //       res.status(500).json({ status: 'error' });
// //     }
// //   });

// //   // ── 404 fallback ──────────────────────────────────────────────────────────
// //   app.use((_req: Request, res: Response) => {
// //     res.status(404).json({ error: 'Route not found' });
// //   });

// //   // ── Socket.io ─────────────────────────────────────────────────────────────
// //   const httpServer = http.createServer(app);
// //   const io = new Server(httpServer, {
// //     cors: { origin: '*', methods: ['GET', 'POST'] },
// //   });

// //   const rateMap = new Map<string, number>();
// //   setInterval(() => rateMap.clear(), 60_000);

// //   io.use((socket, next) => {
// //     const ip  = socket.handshake.address;
// //     const now = Date.now();
// //     if (now - (rateMap.get(ip) ?? 0) < 100) {
// //       return next(new Error('Rate limit exceeded'));
// //     }
// //     rateMap.set(ip, now);
// //     next();
// //   });

// //   setupSocketEvents(io);

// //   // ── Health polling every 30s ──────────────────────────────────────────────
// //   setInterval(async () => {
// //     try {
// //       const stats = await getPoolStats();
// //       await recordSystemHealth(
// //         io.sockets.sockets.size,
// //         io.sockets.sockets.size,
// //         stats.total - stats.idle,
// //         stats.total
// //       );
// //     } catch (e: any) {
// //       console.warn('[Health] Skipped:', e.message);
// //     }
// //   }, 30_000);

// //   // ── Start ─────────────────────────────────────────────────────────────────
// //   httpServer.listen(PORT, () => {
// //     console.log(`✅ Server running on port ${PORT}`);
// //     console.log(`   Auth:       POST /auth/login | /auth/register | /auth/refresh`);
// //     console.log(`   Google:     POST /auth/google/callback`);
// //     console.log(`   Sessions:   GET/POST /sessions`);
// //     console.log(`   Favourites: GET/POST /favourites`);
// //     console.log(`   Profile:    GET/PATCH /profile`);
// //     console.log(`   Health:     GET /health`);
// //   });
// // }

// // bootstrap().catch(err => {
// //   console.error('[Boot] Fatal error:', err);
// //   process.exit(1);
// // });




// // signaling-server/src/server.ts
// //
// // FIX 1 — CORS blocking login/register from GitHub Pages
// //   The old config only allowed FRONTEND_URL + localhost:5173 + localhost:3000.
// //   When FRONTEND_URL was 'http://localhost:5173' (the default), requests from
// //   https://glyphconnect.github.io were rejected with a CORS error.
// //   Fix: ALLOWED_ORIGINS is now built from FRONTEND_URL plus a hardcoded list
// //   that always includes the GitHub Pages domain. Both HTTP REST and
// //   Socket.io now use the same list.
// //
// // FIX 2 — Socket.io rate limiter causing repeated connection failures
// //   The old rule was: "if <100ms since last connection from this IP, reject."
// //   On GitHub Pages, the browser makes multiple rapid socket.io HTTP-upgrade
// //   requests (polling fallback + websocket upgrade) from the same IP, so the
// //   second request was always rejected. That produced the repeated
// //   "socket connection failed" server-side errors.
// //   Fix: rate limit is now 10 connections per SECOND per IP (not per 100ms),
// //   which stops genuine abuse while allowing normal socket.io handshakes.

// import 'dotenv/config';
// import http from 'http';
// import { Server } from 'socket.io';
// import express, { Request, Response } from 'express';
// import cors from 'cors';
// import { setupSocketEvents } from './events';
// import { getPoolStats }      from './db/client';
// import { recordSystemHealth } from './db/admin';
// import authRouter        from './routes/auth';
// import googleAuthRouter  from './routes/google-auth';
// import sessionsRouter    from './routes/sessions';
// import adminRouter       from './routes/admin';
// import favouritesRouter  from './routes/favourites';
// import profileRouter     from './routes/profile';

// const PORT = parseInt(process.env.PORT ?? '8080');

// // ── Allowed CORS origins ───────────────────────────────────────────────────
// // Always include the GitHub Pages domain so the deployed frontend can reach
// // the server regardless of what FRONTEND_URL is set to on EC2.
// const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// const ALLOWED_ORIGINS: string[] = [
//   FRONTEND_URL,
//   'http://localhost:5173',
//   'http://localhost:3000',
//   'http://localhost:4173',          // vite preview
//   'https://glyphconnect.github.io', // ← GitHub Pages deployment
// ];

// // Remove duplicates
// const UNIQUE_ORIGINS = [...new Set(ALLOWED_ORIGINS)];

// async function bootstrap() {
//   const app = express();

//   // ── [FIX 1] CORS — shared list used by both REST and Socket.io ──────────
//   app.use(cors({
//     origin: (origin, callback) => {
//       // Allow requests with no origin (Electron, curl, Postman)
//       if (!origin) return callback(null, true);
//       if (UNIQUE_ORIGINS.includes(origin)) return callback(null, true);
//       console.warn(`[CORS] Blocked origin: ${origin}`);
//       callback(new Error(`Origin ${origin} not allowed`));
//     },
//     credentials: true,
//   }));

//   app.use(express.json({ limit: '2mb' }));
//   app.use(express.urlencoded({ extended: true }));

//   // ── REST routes ───────────────────────────────────────────────────────────
//   app.use('/auth',       authRouter);
//   app.use('/auth',       googleAuthRouter);
//   app.use('/sessions',   sessionsRouter);
//   app.use('/admin',      adminRouter);
//   app.use('/favourites', favouritesRouter);
//   app.use('/profile',    profileRouter);

//   // ── Health check ──────────────────────────────────────────────────────────
//   app.get('/health', async (_req: Request, res: Response) => {
//     try {
//       const stats = await getPoolStats();
//       res.json({ status: 'ok', db_pool: stats, ts: new Date().toISOString() });
//     } catch {
//       res.status(500).json({ status: 'error' });
//     }
//   });

//   // ── 404 fallback ──────────────────────────────────────────────────────────
//   app.use((_req: Request, res: Response) => {
//     res.status(404).json({ error: 'Route not found' });
//   });

//   // ── Socket.io — [FIX 1] same CORS list, [FIX 2] fixed rate limiter ───────
//   const httpServer = http.createServer(app);
//   const io = new Server(httpServer, {
//     cors: {
//       origin: UNIQUE_ORIGINS,
//       methods: ['GET', 'POST'],
//       credentials: true,
//     },
//     // Allow polling fallback so connections work behind corporate firewalls
//     transports: ['websocket', 'polling'],
//   });

//   // [FIX 2] Rate limit: max 10 NEW connections per second per IP.
//   // The old 100ms window was too narrow — socket.io itself makes 2-3 rapid
//   // HTTP requests during the WebSocket upgrade handshake (polling → ws),
//   // which triggered the limit on the second request.
//   const rateMap = new Map<string, { count: number; window: number }>();
//   const RATE_WINDOW_MS   = 1000; // 1 second window
//   const RATE_MAX_CONN    = 10;   // max new connections per window per IP

//   setInterval(() => rateMap.clear(), RATE_WINDOW_MS);

//   io.use((socket, next) => {
//     const ip  = socket.handshake.address;
//     const now = Date.now();
//     const entry = rateMap.get(ip);

//     if (!entry || now - entry.window > RATE_WINDOW_MS) {
//       rateMap.set(ip, { count: 1, window: now });
//       return next();
//     }

//     entry.count++;
//     if (entry.count > RATE_MAX_CONN) {
//       console.warn(`[RateLimit] Too many connections from ${ip}`);
//       return next(new Error('Rate limit exceeded'));
//     }
//     next();
//   });

//   setupSocketEvents(io);

//   // ── Periodic health recording ─────────────────────────────────────────────
//   setInterval(async () => {
//     try {
//       const stats = await getPoolStats();
//       await recordSystemHealth(
//         io.sockets.sockets.size,
//         io.sockets.sockets.size,
//         stats.total - stats.idle,
//         stats.total
//       );
//     } catch (e: any) {
//       console.warn('[Health] Skipped:', e.message);
//     }
//   }, 30_000);

//   // ── Start ─────────────────────────────────────────────────────────────────
//   httpServer.listen(PORT, () => {
//     console.log(`✅ Signaling server on port ${PORT}`);
//     console.log(`   Allowed origins: ${UNIQUE_ORIGINS.join(', ')}`);
//   });
// }

// bootstrap().catch(err => {
//   console.error('[Boot] Fatal:', err);
//   process.exit(1);
// });




// signaling-server/src/server.ts
//
// ROOT CAUSE OF "WSS failed" LOOP + DISCONNECTED ON LAPTOP:
//
// The old rate limiter was:
//   if (now - lastConnectionTime < 100ms) → reject
//
// This is a "one connection per 100ms per IP" rule. Socket.io's normal
// WebSocket upgrade handshake makes 2-3 rapid HTTP requests from the same IP:
//   1. HTTP polling request  (t=0ms)
//   2. WebSocket upgrade probe (t=~10ms)  ← BLOCKED by 100ms rule
//   3. WebSocket connection  (t=~20ms)    ← BLOCKED
//
// So every socket.io connection was guaranteed to fail after the first
// request. Socket.io then retried — each retry also failed. The laptop
// got into an infinite failure cascade. Your friend connected at a lucky
// moment when the rate map had just been cleared (60s interval).
//
// FIX: Rate limiter now counts NEW CONNECTIONS per minute per IP (max 20).
// This allows the 2-3 rapid requests that socket.io needs for its upgrade
// handshake, while still blocking genuine connection floods.

import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { setupSocketEvents }   from './events';
import { getPoolStats }        from './db/client';
import { recordSystemHealth }  from './db/admin';
import authRouter       from './routes/auth';
import googleAuthRouter from './routes/google-auth';
import sessionsRouter   from './routes/sessions';
import adminRouter      from './routes/admin';
import favouritesRouter from './routes/favourites';
import profileRouter    from './routes/profile';

const PORT = parseInt(process.env.PORT ?? '8080');

// ── CORS origins ──────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const ALLOWED_ORIGINS = [...new Set([
  FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://glyphconnect.github.io',
])];

async function bootstrap() {
  const app = express();

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);               // Electron / curl
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      console.warn(`[CORS] Blocked: ${origin}`);
      cb(new Error(`Origin ${origin} not allowed`));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── REST routes ───────────────────────────────────────────────────────────
  app.use('/auth',       authRouter);
  app.use('/auth',       googleAuthRouter);
  app.use('/sessions',   sessionsRouter);
  app.use('/admin',      adminRouter);
  app.use('/favourites', favouritesRouter);
  app.use('/profile',    profileRouter);

  app.get('/health', async (_: Request, res: Response) => {
    try {
      const stats = await getPoolStats();
      res.json({ status: 'ok', db_pool: stats, ts: new Date().toISOString() });
    } catch {
      res.status(500).json({ status: 'error' });
    }
  });

  app.use((_: Request, res: Response) => res.status(404).json({ error: 'Not found' }));

  // ── Socket.io ─────────────────────────────────────────────────────────────
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Allow both transports — polling fallback needed for corporate firewalls
    // and is ALSO needed during the initial socket.io upgrade handshake
    transports: ['websocket', 'polling'],
    // Give the client longer to complete the upgrade handshake
    connectTimeout: 20_000,
    pingTimeout:    30_000,
    pingInterval:   10_000,
  });

  // ── [FIX] Rate limiter — count connections per minute, not per 100ms ──────
  //
  // The old rule (< 100ms between connections from same IP) was fundamentally
  // broken for socket.io because the upgrade handshake itself triggers
  // multiple rapid requests.
  //
  // New rule: max 20 NEW socket connections per IP per 60-second window.
  // A normal user opens 1-2 tabs = 2-4 socket connections. 20 is generous
  // for legitimate use but catches bots trying to flood the server.

  const connCounts = new Map<string, number>();
  const WINDOW_MS  = 60_000;   // 1 minute window
  const MAX_CONN   = 20;       // max NEW connections per window per IP

  // Reset all counts every minute
  setInterval(() => connCounts.clear(), WINDOW_MS);

  io.use((socket, next) => {
    // Prefer X-Forwarded-For (set by nginx) over the direct TCP address
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])
      ?? socket.handshake.address;

    const count = (connCounts.get(ip) ?? 0) + 1;
    connCounts.set(ip, count);

    if (count > MAX_CONN) {
      console.warn(`[RateLimit] ${ip} exceeded ${MAX_CONN} connections/min (count: ${count})`);
      return next(new Error('Too many connections — please wait a moment'));
    }

    next();
  });

  setupSocketEvents(io);

  // ── Health polling ────────────────────────────────────────────────────────
  setInterval(async () => {
    try {
      const stats = await getPoolStats();
      await recordSystemHealth(
        io.sockets.sockets.size,
        io.sockets.sockets.size,
        stats.total - stats.idle,
        stats.total
      );
    } catch (e: any) {
      console.warn('[Health] Skipped:', e.message);
    }
  }, 30_000);

  // ── Start ─────────────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`✅ Server on port ${PORT}`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  });
}

bootstrap().catch(err => {
  console.error('[Boot] Fatal:', err);
  process.exit(1);
});