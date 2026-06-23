import 'dotenv/config';
import dns from 'dns';

// Force IPv4-first DNS resolution — see backend/src/index.ts for the rationale.
// Required so nodemailer (forgot-password OTP, 2FA, support emails) can reach
// smtp.gmail.com on hosts where IPv6 is advertised but unroutable.
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './src/routes/auth.js';
import usersRoutes from './src/routes/users.js';
import notesRoutes from './src/routes/notes.js';
import templatesRoutes from './src/routes/templates.js';
import audioRoutes from './src/routes/audio.js';
import subscriptionRoutes from './src/routes/subscriptions.js';
import adminRoutes from './src/routes/admin.js';
import webhookRoutes from './src/routes/webhooks.js';
import dashboardRoutes from './src/routes/dashboard.js';
import { errorHandler } from './src/middleware/errorHandler.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL?.trim() || true,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing
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

// Error handling
app.use(errorHandler);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
