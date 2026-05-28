import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { setupSocketEvents } from './events';
import { getPoolStats } from './db/client';
import { recordSystemHealth } from './db/admin';
import authRouter from './routes/auth';
import googleAuthRouter from './routes/google-auth';
import sessionsRouter from './routes/sessions';
import adminRouter from './routes/admin';
import favouritesRouter from './routes/favourites';
import profileRouter from './routes/profile';

const PORT = parseInt(process.env.PORT ?? '8080');

async function bootstrap() {
  const app = express();

  // ── CORS — allow frontend origin ──────────────────────────────────────────
  const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── REST routes ───────────────────────────────────────────────────────────
  app.use('/auth',       authRouter);
  app.use('/auth',       googleAuthRouter);   // ← Google OAuth2 (POST /auth/google/callback)
  app.use('/sessions',   sessionsRouter);
  app.use('/admin',      adminRouter);
  app.use('/favourites', favouritesRouter);
  app.use('/profile',    profileRouter);

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const stats = await getPoolStats();
      res.json({ status: 'ok', db_pool: stats, ts: new Date().toISOString() });
    } catch {
      res.status(500).json({ status: 'error' });
    }
  });

  // ── 404 fallback ──────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // ── Socket.io ─────────────────────────────────────────────────────────────
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const rateMap = new Map<string, number>();
  setInterval(() => rateMap.clear(), 60_000);

  io.use((socket, next) => {
    const ip  = socket.handshake.address;
    const now = Date.now();
    if (now - (rateMap.get(ip) ?? 0) < 100) {
      return next(new Error('Rate limit exceeded'));
    }
    rateMap.set(ip, now);
    next();
  });

  setupSocketEvents(io);

  // ── Health polling every 30s ──────────────────────────────────────────────
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
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`   Auth:       POST /auth/login | /auth/register | /auth/refresh`);
    console.log(`   Google:     POST /auth/google/callback`);
    console.log(`   Sessions:   GET/POST /sessions`);
    console.log(`   Favourites: GET/POST /favourites`);
    console.log(`   Profile:    GET/PATCH /profile`);
    console.log(`   Health:     GET /health`);
  });
}

bootstrap().catch(err => {
  console.error('[Boot] Fatal error:', err);
  process.exit(1);
});