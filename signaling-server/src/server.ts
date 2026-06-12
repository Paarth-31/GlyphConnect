import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import { setupSocketEvents }  from './events';
import { getPoolStats }       from './db/client';
import { recordSystemHealth } from './db/admin';
import authRouter       from './routes/auth';
import googleAuthRouter from './routes/google-auth';
import sessionsRouter   from './routes/sessions';
import adminRouter      from './routes/admin';
import favouritesRouter from './routes/favourites';
import profileRouter    from './routes/profile';

const PORT = parseInt(process.env.PORT ?? '8080');
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const ALLOWED_ORIGINS = [...new Set([
  FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://glyphconnect.github.io',
  'https://rda-signaling.duckdns.org',
])];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[CORS] blocked origin: ${origin}`);
    callback(new Error(`Origin "${origin}" is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  maxAge: 86400,
};

async function bootstrap() {
  const app = express();
  app.options(/.*/, cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/reset-password', (_: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
  });

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
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    connectTimeout:    20_000,
    pingTimeout:       30_000,
    pingInterval:      10_000,
    maxHttpBufferSize: 2e6,
  });

  const connCounts = new Map<string, number>();
  setInterval(() => connCounts.clear(), 60_000);

  io.use((socket, next) => {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    const ip  = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim())
              ?? socket.handshake.address;
    const count = (connCounts.get(ip) ?? 0) + 1;
    connCounts.set(ip, count);
    if (count > 20) {
      console.warn(`[rate] ${ip} hit limit (${count})`);
      return next(new Error('Too many connections'));
    }
    next();
  });
  setupSocketEvents(io);

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

  httpServer.listen(PORT, () => {
    console.log(`✅  Server on :${PORT}`);
    console.log(`    Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  });
}

bootstrap().catch(err => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});