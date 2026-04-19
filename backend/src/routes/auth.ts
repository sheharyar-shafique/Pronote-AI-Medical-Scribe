import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
import { signupSchema, loginSchema } from '../types/schemas.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { sendOtpEmail } from '../lib/mailer.js';

// ── OTP Store (in-memory, resets on restart) ────────────────
interface OtpRecord {
  otp: string;
  expiresAt: Date;
  verified: boolean;
}
const otpStore = new Map<string, OtpRecord>();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Failed login tracking (in-memory, resets on restart)
const failedLogins = new Map<string, { count: number; lockedUntil: Date | null }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req, res: Response, next) => {
  try {
    const data = signupSchema.parse(req.body);
    
    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .single();

    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user with 7-day trial
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: data.email,
        password_hash: passwordHash,
        name: data.name,
        specialty: data.specialty || 'General Medicine',
        role: data.email.includes('admin') ? 'admin' : 'clinician',
        subscription_status: 'trial',
        subscription_plan: 'practice',
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Create default user settings
    await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        default_template: 'soap',
        auto_save: true,
        dark_mode: false,
        notifications_enabled: true,
      });

    // Generate JWT (24h expiry for HIPAA session management)
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'user_signup',
      resource_type: 'user',
      resource_id: user.id,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        specialty: user.specialty,
        subscriptionStatus: user.subscription_status,
        subscriptionPlan: user.subscription_plan,
        trialEndsAt: user.trial_ends_at,
        createdAt: user.created_at,
        avatar: user.avatar_url,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res: Response, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Check if account is locked
    const loginRecord = failedLogins.get(data.email);
    if (loginRecord?.lockedUntil && loginRecord.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((loginRecord.lockedUntil.getTime() - Date.now()) / 60000);
      
      await writeAuditLog({
        user_id: null,
        action: 'auth_account_locked',
        resource_type: 'auth',
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        metadata: { email: data.email, minutes_remaining: minutesLeft },
      });

      throw new AppError(
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        423
      );
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', data.email)
      .single();

    if (error || !user) {
      // Track failed attempt
      const record = failedLogins.get(data.email) || { count: 0, lockedUntil: null };
      record.count += 1;
      if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      failedLogins.set(data.email, record);

      await writeAuditLog({
        user_id: null,
        action: 'auth_login_failed',
        resource_type: 'auth',
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        metadata: { email: data.email, reason: 'invalid_email', attempt: record.count },
      });

      throw new AppError('Invalid email or password', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
    
    if (!isValidPassword) {
      // Track failed attempt
      const record = failedLogins.get(data.email) || { count: 0, lockedUntil: null };
      record.count += 1;
      if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      failedLogins.set(data.email, record);

      await writeAuditLog({
        user_id: user.id,
        action: 'auth_login_failed',
        resource_type: 'auth',
        ip_address: clientIp,
        user_agent: req.headers['user-agent'],
        metadata: { email: data.email, reason: 'invalid_password', attempt: record.count },
      });

      throw new AppError('Invalid email or password', 401);
    }

    // Reset failed login counter on success
    failedLogins.delete(data.email);

    // Check if trial has expired
    if (user.subscription_status === 'trial' && user.trial_ends_at) {
      if (new Date(user.trial_ends_at) < new Date()) {
        await supabase
          .from('users')
          .update({ subscription_status: 'inactive' })
          .eq('id', user.id);
        user.subscription_status = 'inactive';
      }
    }

    // Generate JWT (24h expiry for HIPAA session management)
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Log successful login (HIPAA audit)
    await writeAuditLog({
      user_id: user.id,
      action: 'auth_login_success',
      resource_type: 'auth',
      ip_address: clientIp,
      user_agent: req.headers['user-agent'],
      metadata: { email: data.email },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        specialty: user.specialty,
        subscriptionStatus: user.subscription_status,
        subscriptionPlan: user.subscription_plan,
        trialEndsAt: user.trial_ends_at,
        createdAt: user.created_at,
        avatar: user.avatar_url,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      specialty: user.specialty,
      subscriptionStatus: user.subscription_status,
      subscriptionPlan: user.subscription_plan,
      trialEndsAt: user.trial_ends_at,
      createdAt: user.created_at,
      avatar: user.avatar_url,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'user_logout',
      resource_type: 'user',
      resource_id: req.user!.id,
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const token = jwt.sign(
      { userId: req.user!.id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current and new password are required', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400);
    }

    // Get user with password
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', req.user!.id);

    // HIPAA audit: log password change
    await writeAuditLog({
      user_id: req.user!.id,
      action: 'auth_password_change',
      resource_type: 'auth',
      ip_address: req.ip || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'],
      metadata: {},
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});


// POST /api/auth/forgot-password — send OTP to email
router.post('/forgot-password', async (req, res: Response, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email is required', 400);

    // Check user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .single();

    // Always respond success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, an OTP has been sent.' });
    }

    const otp = generateOtp();
    otpStore.set(email.toLowerCase(), {
      otp,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      verified: false,
    });

    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to your email. It expires in 10 minutes.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify-otp — verify the 6-digit OTP
router.post('/verify-otp', async (req, res: Response, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw new AppError('Email and OTP are required', 400);

    const record = otpStore.get(email.toLowerCase());

    if (!record) throw new AppError('No OTP request found. Please request a new one.', 400);
    if (new Date() > record.expiresAt) {
      otpStore.delete(email.toLowerCase());
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }
    if (record.otp !== otp.trim()) throw new AppError('Invalid OTP. Please try again.', 400);

    // Mark as verified so reset-password can proceed
    record.verified = true;
    otpStore.set(email.toLowerCase(), record);

    res.json({ message: 'OTP verified successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password — set new password after OTP verified
router.post('/reset-password', async (req, res: Response, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      throw new AppError('Email, OTP and new password are required', 400);
    }
    if (newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const record = otpStore.get(email.toLowerCase());

    if (!record || !record.verified) {
      throw new AppError('OTP not verified. Please complete verification first.', 400);
    }
    if (record.otp !== otp.trim()) throw new AppError('Invalid OTP.', 400);
    if (new Date() > record.expiresAt) {
      otpStore.delete(email.toLowerCase());
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', email.toLowerCase());

    if (error) throw error;

    // Clear OTP after successful reset
    otpStore.delete(email.toLowerCase());

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
});

export default router;
