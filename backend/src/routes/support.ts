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

// Identifies the BAA template currently presented to users. Bump this when the
// BAA text in HipaaBaaPage.tsx changes so the audit trail records exactly
// which version each customer agreed to. Past acceptances are NEVER mutated —
// HIPAA requires the agreement-as-signed to remain intact.
const BAA_VERSION = '2026-05-06.v1';

// POST /api/support/accept-baa — Accept HIPAA BAA
//
// HIPAA BAA is now available on every paid plan (no subscription gating).
// Acceptance creates a tamper-evident audit record on the user row AND a
// row in activity_logs that captures the metadata HIPAA-style audits expect:
// who, when, from where (IP), via what client (user-agent), and which version
// of the BAA they agreed to.
router.post('/accept-baa', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { organizationName, signerTitle } = req.body;
    if (!organizationName?.trim()) throw new AppError('Organization name is required', 400);

    const acceptedAt = new Date().toISOString();
    // express trust-proxy is set in src/index.ts so req.ip resolves to the
    // real client IP (not the Render proxy IP) when X-Forwarded-For is set.
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent')?.slice(0, 500) || 'unknown';

    await supabase.from('users').update({
      hipaa_baa_accepted: true,
      hipaa_baa_accepted_at: acceptedAt,
      hipaa_baa_organization: organizationName.trim(),
      hipaa_baa_signer_title: signerTitle?.trim() || 'Authorized Signatory',
      hipaa_baa_version: BAA_VERSION,
      hipaa_baa_ip_address: ipAddress,
      hipaa_baa_user_agent: userAgent,
    }).eq('id', req.user!.id);

    // Activity log — append-only; never edit or delete past entries. This is
    // what gets shown to a HIPAA auditor as proof of consent.
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'hipaa_baa_accepted',
      resource_type: 'compliance',
      metadata: {
        organizationName: organizationName.trim(),
        signerTitle: signerTitle?.trim() || 'Authorized Signatory',
        acceptedAt,
        baaVersion: BAA_VERSION,
        ipAddress,
        userAgent,
        userEmail: req.user!.email,
      },
    });

    res.json({
      success: true,
      acceptedAt,
      baaVersion: BAA_VERSION,
      message: 'HIPAA BAA accepted and recorded.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/support/baa-status — Get BAA acceptance status
router.get('/baa-status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Single literal select string — Supabase's TS inference parses this at
    // compile time and would lose typing if we used string concatenation.
    const { data: user } = await supabase
      .from('users')
      .select('hipaa_baa_accepted, hipaa_baa_accepted_at, hipaa_baa_organization, hipaa_baa_signer_title, hipaa_baa_version, hipaa_baa_ip_address, name, email, subscription_plan')
      .eq('id', req.user!.id)
      .single();

    res.json({
      accepted: user?.hipaa_baa_accepted || false,
      acceptedAt: user?.hipaa_baa_accepted_at || null,
      organization: user?.hipaa_baa_organization || null,
      signerTitle: user?.hipaa_baa_signer_title || null,
      baaVersion: user?.hipaa_baa_version || null,
      ipAddress: user?.hipaa_baa_ip_address || null,
      currentBaaVersion: BAA_VERSION,
      name: user?.name,
      email: user?.email,
      plan: user?.subscription_plan,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
