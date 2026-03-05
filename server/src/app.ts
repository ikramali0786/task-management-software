import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Trust Render / reverse-proxy's X-Forwarded-For header so that
// express-rate-limit can correctly identify client IPs in production.
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Rate limiting
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    message: 'Too many requests. Please try again later.',
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Catch-all handler
// • Unknown /api/* paths  → JSON 404 (standard REST behaviour)
// • Everything else       → redirect the browser to the React SPA at CLIENT_URL
//   This covers the case where someone refreshes on a client-side route while
//   their browser is pointed at the Express server URL instead of the static-
//   site / Vite dev-server URL (e.g. localhost:5000/login instead of localhost/login).
app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }
  // Strip trailing slash from CLIENT_URL so we don't double-up
  const clientBase = env.CLIENT_URL.replace(/\/$/, '');
  return res.redirect(302, `${clientBase}${req.path}`);
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
