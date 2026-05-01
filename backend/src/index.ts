import 'dotenv/config';
import dns from 'dns';

// Force IPv4-first DNS resolution. Some hosts (notably Render's free tier) advertise
// IPv6 addresses but can't actually route them, which surfaces as ENETUNREACH when
// nodemailer connects to smtp.gmail.com (e.g. forgot-password OTP send). Node 17+ defaults
// to "verbatim" order which prefers whichever address family DNS returns first.
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import notesRoutes from './routes/notes.js';
import templatesRoutes from './routes/templates.js';
import audioRoutes from './routes/audio.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import dashboardRoutes from './routes/dashboard.js';
import teamsRoutes from './routes/teams.js';
import cronRoutes from './routes/cron.js';
import supportRoutes from './routes/support.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initializePayPalPlans } from './lib/paypalInit.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (required for Render, Heroku, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Build allowed origins list from env (comma-separated support)
const rawOrigins = process.env.FRONTEND_URL?.trim() || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim().replace(/\/$/, '')) // strip trailing slashes
  .filter(Boolean);

// Always-allowed origin patterns: localhost / 127.0.0.1 / 0.0.0.0 on any port,
// plus the Capacitor file:// origins that iOS and Android use when serving the
// bundled mobile app from the WebView. These don't need to live in FRONTEND_URL
// because they aren't deploy-targets — they're development hosts and on-device
// runtimes that we can never reasonably enumerate.
const isDevOrCapacitorOrigin = (origin: string): boolean => {
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin)) return true;
  if (origin === 'capacitor://localhost') return true; // iOS WKWebView
  if (origin === 'http://localhost') return true;       // Android WebView (no port)
  if (origin === 'ionic://localhost') return true;      // legacy Ionic bridge
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Normalize incoming origin (strip trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');

    if (
      allowedOrigins.length === 0 ||
      allowedOrigins.includes(normalizedOrigin) ||
      isDevOrCapacitorOrigin(normalizedOrigin)
    ) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin} | Allowed: ${allowedOrigins.join(', ')}`);
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing - exclude webhooks route (needs raw body for Stripe/PayPal)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use('/api/webhooks/paypal', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/support', supportRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Only listen when not in serverless environment
if (process.env.VERCEL !== '1') {
  // Whisper transcription of long audio (30+ min) can take several minutes; bump
  // the Node HTTP server timeouts so the connection isn't dropped mid-request.
  // 0 = no timeout. headersTimeout/keepAliveTimeout govern proxy behavior.
  const configureTimeouts = (server: import('http').Server) => {
    server.timeout = 0;                        // no socket inactivity timeout
    server.requestTimeout = 0;                 // no per-request timeout
    server.headersTimeout = 20 * 60 * 1000;    // 20 min for headers
    server.keepAliveTimeout = 20 * 60 * 1000;  // 20 min keep-alive
  };

  // Initialize PayPal plans then start server
  initializePayPalPlans().then(() => {
    const server = app.listen(PORT, () => {
      console.log(`🚀 Pronote API server running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    configureTimeouts(server);
  }).catch((err) => {
    console.error('Startup error:', err);
    // Start anyway even if PayPal init fails
    const server = app.listen(PORT, () => {
      console.log(`🚀 Pronote API server running on http://localhost:${PORT}`);
    });
    configureTimeouts(server);
  });
}

export default app;
