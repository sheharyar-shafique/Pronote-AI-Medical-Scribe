import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import bcrypt from 'bcryptjs';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/stats - Get platform statistics
router.get('/stats', async (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Active subscriptions
    const { count: activeSubscriptions } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('subscription_status', ['active', 'trial']);

    // Total notes
    const { count: totalNotes } = await supabase
      .from('clinical_notes')
      .select('*', { count: 'exact', head: true });

    // Notes this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: notesThisMonth } = await supabase
      .from('clinical_notes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    // Users by plan
    const { data: planStats } = await supabase
      .from('users')
      .select('subscription_plan')
      .not('subscription_plan', 'is', null);

    const planCounts = planStats?.reduce((acc, user) => {
      acc[user.subscription_plan] = (acc[user.subscription_plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    res.json({
      totalUsers: totalUsers || 0,
      activeSubscriptions: activeSubscriptions || 0,
      totalNotes: totalNotes || 0,
      notesThisMonth: notesThisMonth || 0,
      usersByPlan: planCounts,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users - List all users
router.get('/users', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { page = '1', limit = '20', search, status, role } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabase
      .from('users')
      .select('id, email, name, role, specialty, subscription_status, subscription_plan, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('subscription_status', status);
    }

    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    // Get notes count for each user
    const userIds = users.map(u => u.id);
    const { data: noteCounts } = await supabase
      .from('clinical_notes')
      .select('user_id')
      .in('user_id', userIds);

    const noteCountMap = noteCounts?.reduce((acc, note) => {
      acc[note.user_id] = (acc[note.user_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        specialty: user.specialty,
        status: user.subscription_status,
        plan: user.subscription_plan,
        notesCount: noteCountMap[user.id] || 0,
        createdAt: user.created_at,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new AppError('User not found', 404);
    }

    // Get user's notes count
    const { count: notesCount } = await supabase
      .from('clinical_notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id);

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', id)
      .single();

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
      notesCount: notesCount || 0,
      subscription: subscription || null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users - Create a new user
router.post('/users', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { email, password, name, role, specialty, subscriptionPlan } = req.body;

    if (!email || !password || !name) {
      throw new AppError('Email, password, and name are required', 400);
    }

    // Check if email exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name,
        role: role || 'clinician',
        specialty: specialty || 'General Medicine',
        subscription_status: 'active',
        subscription_plan: subscriptionPlan || 'practice',
      })
      .select()
      .single();

    if (error) throw error;

    // Create user settings
    await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        default_template: 'soap',
      });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { name, role, specialty, subscriptionStatus, subscriptionPlan } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (specialty) updateData.specialty = specialty;
    if (subscriptionStatus) updateData.subscription_status = subscriptionStatus;
    if (subscriptionPlan) updateData.subscription_plan = subscriptionPlan;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
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
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/users/:id/status - Update user status
router.put('/users/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    // Map frontend status to subscription_status
    const subscriptionStatus = status === 'suspended' ? 'inactive' : status;

    const { data: user, error } = await supabase
      .from('users')
      .update({ subscription_status: subscriptionStatus })
      .eq('id', id)
      .select()
      .single();

    if (error || !user) {
      throw new AppError('User not found', 404);
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: `admin_user_status_${status}`,
      resource_type: 'user',
      resource_id: id,
    });

    res.json({ message: 'User status updated', status: subscriptionStatus });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user!.id) {
      throw new AppError('Cannot delete your own account', 400);
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'admin_user_deleted',
      resource_type: 'user',
      resource_id: id,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/activity - Get activity logs
router.get('/activity', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { page = '1', limit = '50', userId, action } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabase
      .from('activity_logs')
      .select('*, users!activity_logs_user_id_fkey(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (action) {
      query = query.ilike('action', `%${action}%`);
    }

    const { data: logs, error, count } = await query;

    if (error) throw error;

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        userId: log.user_id,
        userName: log.users?.name,
        userEmail: log.users?.email,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        metadata: log.metadata,
        createdAt: log.created_at,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
