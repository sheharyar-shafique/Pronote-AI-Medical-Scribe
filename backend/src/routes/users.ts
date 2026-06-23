import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { updateUserSchema, updateSettingsSchema } from '../types/schemas.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/users/profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response, next) => {
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

// PUT /api/users/profile
router.put('/profile', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = updateUserSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.specialty) updateData.specialty = data.specialty;
    if (data.avatar) updateData.avatar_url = data.avatar;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) throw error;

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

// GET /api/users/settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    let { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', req.user!.id)
      .single();

    // Create default settings if not exists
    if (!settings) {
      const { data: newSettings, error: createError } = await supabase
        .from('user_settings')
        .insert({
          user_id: req.user!.id,
          default_template: 'soap',
          auto_save: true,
          dark_mode: false,
          notifications_enabled: true,
        })
        .select()
        .single();

      if (createError) throw createError;
      settings = newSettings;
    }

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      defaultTemplate: settings?.default_template || 'soap',
      autoSave: settings?.auto_save ?? true,
      darkMode: settings?.dark_mode ?? false,
      notificationsEnabled: settings?.notifications_enabled ?? true,
      audioQuality: settings?.audio_quality || 'high',
      language: settings?.language || 'en-US',
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/settings
router.put('/settings', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = updateSettingsSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (data.defaultTemplate) updateData.default_template = data.defaultTemplate;
    if (typeof data.autoSave === 'boolean') updateData.auto_save = data.autoSave;
    if (typeof data.darkMode === 'boolean') updateData.dark_mode = data.darkMode;
    if (typeof data.notificationsEnabled === 'boolean') updateData.notifications_enabled = data.notificationsEnabled;
    if (data.audioQuality) updateData.audio_quality = data.audioQuality;
    if (data.language) updateData.language = data.language;

    const { data: settings, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: req.user!.id,
        ...updateData,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      defaultTemplate: settings.default_template,
      autoSave: settings.auto_save,
      darkMode: settings.dark_mode,
      notificationsEnabled: settings.notifications_enabled,
      audioQuality: settings.audio_quality,
      language: settings.language,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/stats
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Get total notes count
    const { count: totalNotes } = await supabase
      .from('clinical_notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.id);

    // Get notes this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { count: notesThisWeek } = await supabase
      .from('clinical_notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.id)
      .gte('created_at', weekAgo.toISOString());

    res.json({
      totalNotes: totalNotes || 0,
      notesThisWeek: notesThisWeek || 0,
      averageTime: '45min', // This would be calculated from actual timing data
      accuracy: '98.5%', // This would be calculated from transcription accuracy
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/account
router.delete('/account', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Delete user (cascade will handle related records)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.user!.id);

    if (error) throw error;

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
