import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { createTemplateSchema } from '../types/schemas.js';
import { authenticate, requireActiveSubscription, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Template Preferences (cross-device sync) ────────────────────────────────
// MUST be defined BEFORE any /:id routes so Express doesn't swallow "preferences"
// as a template id.

// GET /api/templates/preferences
router.get('/preferences', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('template_preferences')
      .eq('user_id', req.user!.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = row not found

    res.json({ preferences: data?.template_preferences ?? null });
  } catch (error) {
    next(error);
  }
});

// PUT /api/templates/preferences
router.put('/preferences', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { addedIds, customTemplates } = req.body as {
      addedIds: string[];
      customTemplates: unknown[];
    };

    if (!Array.isArray(addedIds) || !Array.isArray(customTemplates)) {
      res.status(400).json({ error: 'addedIds and customTemplates must be arrays' });
      return;
    }

    const preferences = { addedIds, customTemplates };

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: req.user!.id, template_preferences: preferences },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    res.json({ message: 'Preferences saved', preferences });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/templates - Get all templates (default + user custom)
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .or(`is_default.eq.true,user_id.eq.${req.user!.id}`)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;

    res.json(templates.map(template => ({
      id: template.template_type,
      dbId: template.id,
      name: template.name,
      description: template.description,
      sections: template.sections,
      specialty: template.specialty,
      isDefault: template.is_default,
      isCustom: !template.is_default,
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/templates/:id - Get a single template
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .or(`is_default.eq.true,user_id.eq.${req.user!.id}`)
      .single();

    if (error || !template) {
      throw new AppError('Template not found', 404);
    }

    res.json({
      id: template.template_type,
      dbId: template.id,
      name: template.name,
      description: template.description,
      sections: template.sections,
      specialty: template.specialty,
      isDefault: template.is_default,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/templates - Create a custom template
router.post('/', requireActiveSubscription, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = createTemplateSchema.parse(req.body);

    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        user_id: req.user!.id,
        name: data.name,
        description: data.description,
        template_type: data.templateType,
        sections: data.sections,
        specialty: data.specialty,
        is_default: false,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: template.template_type,
      dbId: template.id,
      name: template.name,
      description: template.description,
      sections: template.sections,
      specialty: template.specialty,
      isDefault: false,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/templates/:id - Update a custom template
router.put('/:id', requireActiveSubscription, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = createTemplateSchema.partial().parse(req.body);

    const { data: existingTemplate, error: checkError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .eq('is_default', false)
      .single();

    if (checkError || !existingTemplate) {
      throw new AppError('Template not found or cannot be edited', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.templateType) updateData.template_type = data.templateType;
    if (data.sections) updateData.sections = data.sections;
    if (data.specialty !== undefined) updateData.specialty = data.specialty;

    const { data: template, error } = await supabase
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      id: template.template_type,
      dbId: template.id,
      name: template.name,
      description: template.description,
      sections: template.sections,
      specialty: template.specialty,
      isDefault: false,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/templates/:id - Delete a custom template
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .eq('is_default', false);

    if (error) throw error;

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
