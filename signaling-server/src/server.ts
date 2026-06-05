// // signaling-server/src/server.ts
// //
// // ROOT CAUSE OF "WSS failed" LOOP + DISCONNECTED ON LAPTOP:
// //
// // The old rate limiter was:
// //   if (now - lastConnectionTime < 100ms) → reject
// //
// // This is a "one connection per 100ms per IP" rule. Socket.io's normal
// // WebSocket upgrade handshake makes 2-3 rapid HTTP requests from the same IP:
// //   1. HTTP polling request  (t=0ms)
// //   2. WebSocket upgrade probe (t=~10ms)  ← BLOCKED by 100ms rule
// //   3. WebSocket connection  (t=~20ms)    ← BLOCKED
// //
// // So every socket.io connection was guaranteed to fail after the first
// // request. Socket.io then retried — each retry also failed. The laptop
// // got into an infinite failure cascade. Your friend connected at a lucky
// // moment when the rate map had just been cleared (60s interval).
// //
// // FIX: Rate limiter now counts NEW CONNECTIONS per minute per IP (max 20).
// // This allows the 2-3 rapid requests that socket.io needs for its upgrade
// // handshake, while still blocking genuine connection floods.

// import 'dotenv/config';
// import http from 'http';
// import { Server } from 'socket.io';
// import express, { Request, Response } from 'express';
// import cors from 'cors';
// import { setupSocketEvents }   from './events';
// import { getPoolStats }        from './db/client';
// import { recordSystemHealth }  from './db/admin';
// import authRouter       from './routes/auth';
// import googleAuthRouter from './routes/google-auth';
// import sessionsRouter   from './routes/sessions';
// import adminRouter      from './routes/admin';
// import favouritesRouter from './routes/favourites';
// import profileRouter    from './routes/profile';

// const PORT = parseInt(process.env.PORT ?? '8080');

// // ── CORS origins ──────────────────────────────────────────────────────────────
// const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// const ALLOWED_ORIGINS = [...new Set([
//   FRONTEND_URL,
//   'http://localhost:5173',
//   'http://localhost:3000',
//   'http://localhost:4173',
//   'https://glyphconnect.github.io',
// ])];

// async function bootstrap() {
//   const app = express();

//   app.use(cors({
//     origin: (origin, cb) => {
//       if (!origin) return cb(null, true);               // Electron / curl
//       if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
//       console.warn(`[CORS] Blocked: ${origin}`);
//       cb(new Error(`Origin ${origin} not allowed`));
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

//   app.get('/health', async (_: Request, res: Response) => {
//     try {
//       const stats = await getPoolStats();
//       res.json({ status: 'ok', db_pool: stats, ts: new Date().toISOString() });
//     } catch {
//       res.status(500).json({ status: 'error' });
//     }
//   });

//   app.use((_: Request, res: Response) => res.status(404).json({ error: 'Not found' }));

//   // ── Socket.io ─────────────────────────────────────────────────────────────
//   const httpServer = http.createServer(app);

//   const io = new Server(httpServer, {
//     cors: {
//       origin: ALLOWED_ORIGINS,
//       methods: ['GET', 'POST'],
//       credentials: true,
//     },
//     // Allow both transports — polling fallback needed for corporate firewalls
//     // and is ALSO needed during the initial socket.io upgrade handshake
//     transports: ['websocket', 'polling'],
//     // Give the client longer to complete the upgrade handshake
//     connectTimeout: 20_000,
//     pingTimeout:    30_000,
//     pingInterval:   10_000,
//   });

//   // ── [FIX] Rate limiter — count connections per minute, not per 100ms ──────
//   //
//   // The old rule (< 100ms between connections from same IP) was fundamentally
//   // broken for socket.io because the upgrade handshake itself triggers
//   // multiple rapid requests.
//   //
//   // New rule: max 20 NEW socket connections per IP per 60-second window.
//   // A normal user opens 1-2 tabs = 2-4 socket connections. 20 is generous
//   // for legitimate use but catches bots trying to flood the server.

//   const connCounts = new Map<string, number>();
//   const WINDOW_MS  = 60_000;   // 1 minute window
//   const MAX_CONN   = 20;       // max NEW connections per window per IP

//   // Reset all counts every minute
//   setInterval(() => connCounts.clear(), WINDOW_MS);

//   io.use((socket, next) => {
//     // Prefer X-Forwarded-For (set by nginx) over the direct TCP address
//     const forwarded = socket.handshake.headers['x-forwarded-for'];
//     const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])
//       ?? socket.handshake.address;

//     const count = (connCounts.get(ip) ?? 0) + 1;
//     connCounts.set(ip, count);

//     if (count > MAX_CONN) {
//       console.warn(`[RateLimit] ${ip} exceeded ${MAX_CONN} connections/min (count: ${count})`);
//       return next(new Error('Too many connections — please wait a moment'));
//     }

//     next();
//   });

//   setupSocketEvents(io);

//   // ── Health polling ────────────────────────────────────────────────────────
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
//     console.log(`✅ Server on port ${PORT}`);
//     console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
//   });
// }

// bootstrap().catch(err => {
//   console.error('[Boot] Fatal:', err);
//   process.exit(1);
// });





// signaling-server/src/server.ts
//
// FIXES:
// [RATE] Rate limiter rewritten: 20 connections per IP per 60s window.
//   Old rule (< 100ms) blocked socket.io's own handshake requests.
// [CORS] GitHub Pages origin always in allowed list.
// [TIMEOUT] connectTimeout / pingTimeout raised so long sessions don't drop.

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

// ── CORS origins ──────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const ALLOWED_ORIGINS = [...new Set([
  FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://glyphconnect.github.io',  // always include GitHub Pages
])];

async function bootstrap() {
  const app = express();

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);  // Electron / curl / Postman
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      console.warn(`[CORS] blocked: ${origin}`);
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
    transports: ['websocket', 'polling'],
    connectTimeout:  20_000,
    pingTimeout:     30_000,
    pingInterval:    10_000,
    maxHttpBufferSize: 2e6,  // 2 MB for binary data channel relay
  });

  // ── [FIX] Rate limiter: max 20 NEW connections per IP per 60s ────────────
  // Old: < 100ms between connections → blocked socket.io's own handshake.
  // New: count per 60s window → allows the 2-3 rapid requests socket.io
  //      makes during the WebSocket upgrade handshake.
  const connCounts = new Map<string, number>();
  const WINDOW_MS  = 60_000;
  const MAX_CONN   = 20;

  setInterval(() => connCounts.clear(), WINDOW_MS);

  io.use((socket, next) => {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    const ip  = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim())
      ?? socket.handshake.address;

    const count = (connCounts.get(ip) ?? 0) + 1;
    connCounts.set(ip, count);

    if (count > MAX_CONN) {
      console.warn(`[rate] ${ip} hit limit (${count})`);
      return next(new Error('Too many connections'));
    }
    next();
  });

  setupSocketEvents(io);

  // ── Health snapshots ──────────────────────────────────────────────────────
  setInterval(async () => {
    try {
      const stats = await getPoolStats();
      await recordSystemHealth(
        io.sockets.sockets.size,
        io.sockets.sockets.size,
        stats.total - stats.idle,
        stats.total,
      );
    } catch (e: any) {
      console.warn('[health] skipped:', e.message);
    }
  }, 30_000);

  // ── Start ─────────────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`✅  Signaling server on :${PORT}`);
    console.log(`    Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  });
}

bootstrap().catch(err => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});