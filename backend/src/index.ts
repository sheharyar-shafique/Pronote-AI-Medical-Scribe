import 'dotenv/config';
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

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Normalize incoming origin (strip trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');

    if (allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
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

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Only listen when not in serverless environment
if (process.env.VERCEL !== '1') {
  // Initialize PayPal plans then start server
  initializePayPalPlans().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Pronote API server running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }).catch((err) => {
    console.error('Startup error:', err);
    // Start anyway even if PayPal init fails
    app.listen(PORT, () => {
      console.log(`🚀 Pronote API server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
