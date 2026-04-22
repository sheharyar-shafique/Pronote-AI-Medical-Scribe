import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendSupportEmail } from '../lib/mailer.js';

const router = Router();
router.use(authenticate);

// POST /api/support — Submit a support ticket
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { subject, message, category = 'general' } = req.body;

    if (!subject?.trim()) throw new AppError('Subject is required', 400);
    if (!message?.trim()) throw new AppError('Message is required', 400);
    if (message.trim().length < 10) throw new AppError('Message must be at least 10 characters', 400);

    const user = req.user!;

    // Fetch full user for plan info
    const { data: fullUser } = await supabase
      .from('users')
      .select('name, email, subscription_plan, subscription_status')
      .eq('id', user.id)
      .single();

    const isPriority = fullUser?.subscription_plan?.startsWith('group') ?? false;
    const userName   = fullUser?.name || 'User';
    const userEmail  = fullUser?.email || '';
    const plan       = fullUser?.subscription_plan || 'trial';

    // Generate ticket ID
    const ticketId = `PRN-${Date.now().toString(36).toUpperCase()}`;

    // Send emails
    await sendSupportEmail({
      ticketId,
      userName,
      userEmail,
      subject: subject.trim(),
      message: message.trim(),
      category,
      plan,
      isPriority,
    });

    // Log to activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'support_ticket_created',
      resource_type: 'support',
      resource_id: ticketId,
      metadata: { subject, category, isPriority },
    });

    res.status(201).json({
      ticketId,
      message: 'Support ticket submitted successfully. Check your email for confirmation.',
      isPriority,
      estimatedResponse: isPriority ? '< 4 hours' : '< 24 hours',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/support/accept-baa — Accept HIPAA BAA
router.post('/accept-baa', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { organizationName, signerTitle } = req.body;
    if (!organizationName?.trim()) throw new AppError('Organization name is required', 400);

    const acceptedAt = new Date().toISOString();

    await supabase.from('users').update({
      hipaa_baa_accepted: true,
      hipaa_baa_accepted_at: acceptedAt,
      hipaa_baa_organization: organizationName.trim(),
      hipaa_baa_signer_title: signerTitle?.trim() || 'Authorized Signatory',
    }).eq('id', req.user!.id);

    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'hipaa_baa_accepted',
      resource_type: 'compliance',
      metadata: { organizationName, signerTitle, acceptedAt },
    });

    res.json({ success: true, acceptedAt, message: 'HIPAA BAA accepted and recorded.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/support/baa-status — Get BAA acceptance status
router.get('/baa-status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('hipaa_baa_accepted, hipaa_baa_accepted_at, hipaa_baa_organization, hipaa_baa_signer_title, name, email, subscription_plan')
      .eq('id', req.user!.id)
      .single();

    res.json({
      accepted: user?.hipaa_baa_accepted || false,
      acceptedAt: user?.hipaa_baa_accepted_at || null,
      organization: user?.hipaa_baa_organization || null,
      signerTitle: user?.hipaa_baa_signer_title || null,
      name: user?.name,
      email: user?.email,
      plan: user?.subscription_plan,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
