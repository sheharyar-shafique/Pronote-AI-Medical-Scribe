import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { sendTrialReminderEmail } from '../lib/mailer.js';

const router = Router();

// ── Security: require a secret key so only authorized callers can trigger cron
function verifyCronSecret(req: Request, res: Response): boolean {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── POST /api/cron/trial-reminder ─────────────────────────────────────────────
// Call this daily from cron-job.org / Render cron / GitHub Actions etc.
// Sends reminder emails to trial users with 2 days left AND 1 day left.
// Uses trial_reminder_2d_sent / trial_reminder_1d_sent flags to avoid duplicates.
router.post('/trial-reminder', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  const now        = new Date();
  const in1Day     = new Date(now.getTime() + 1  * 24 * 60 * 60 * 1000);
  const in2Days    = new Date(now.getTime() + 2  * 24 * 60 * 60 * 1000);
  const in3Days    = new Date(now.getTime() + 3  * 24 * 60 * 60 * 1000);

  const frontendUrl = process.env.FRONTEND_URL?.split(',')[0]?.trim() || '';
  const upgradeUrl  = `${frontendUrl}/settings`;

  const results = { sent: 0, skipped: 0, errors: 0 };

  try {
    // ── Fetch trial users whose trial ends in the next 1–3 days ──────────────
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, trial_ends_at, trial_reminder_2d_sent, trial_reminder_1d_sent')
      .eq('subscription_status', 'trial')
      .gte('trial_ends_at', now.toISOString())
      .lte('trial_ends_at', in3Days.toISOString());

    if (error) {
      console.error('[Cron] DB error fetching trial users:', error);
      res.status(500).json({ error: 'Database error', detail: error.message });
      return;
    }

    if (!users || users.length === 0) {
      res.json({ message: 'No trial users need reminders right now', ...results });
      return;
    }

    for (const user of users) {
      const trialEnd  = new Date(user.trial_ends_at);
      const msLeft    = trialEnd.getTime() - now.getTime();
      const daysLeft  = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      try {
        // ── 2-day reminder ────────────────────────────────────────────────────
        if (daysLeft === 2 && !user.trial_reminder_2d_sent) {
          await sendTrialReminderEmail(user.email, user.name || 'Doctor', 2, upgradeUrl);
          await supabase
            .from('users')
            .update({ trial_reminder_2d_sent: true })
            .eq('id', user.id);
          results.sent++;
          console.log(`[Cron] 2-day reminder sent to ${user.email}`);
        }

        // ── 1-day (last day) reminder ─────────────────────────────────────────
        else if (daysLeft <= 1 && !user.trial_reminder_1d_sent) {
          await sendTrialReminderEmail(user.email, user.name || 'Doctor', 1, upgradeUrl);
          await supabase
            .from('users')
            .update({ trial_reminder_1d_sent: true })
            .eq('id', user.id);
          results.sent++;
          console.log(`[Cron] 1-day reminder sent to ${user.email}`);
        }

        else {
          results.skipped++;
        }
      } catch (mailErr) {
        console.error(`[Cron] Failed to send reminder to ${user.email}:`, mailErr);
        results.errors++;
      }
    }

    res.json({
      message: 'Trial reminder job complete',
      usersChecked: users.length,
      ...results,
    });
  } catch (err) {
    console.error('[Cron] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/cron/trial-reminder ── health-check / dry-run (shows who would get emailed)
router.get('/trial-reminder', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  const now     = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, trial_ends_at, trial_reminder_2d_sent, trial_reminder_1d_sent')
    .eq('subscription_status', 'trial')
    .gte('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', in3Days.toISOString());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const preview = (users || []).map(u => {
    const daysLeft = Math.ceil((new Date(u.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      email: u.email,
      daysLeft,
      reminder2dSent: u.trial_reminder_2d_sent,
      reminder1dSent: u.trial_reminder_1d_sent,
      wouldSend: (daysLeft === 2 && !u.trial_reminder_2d_sent) || (daysLeft <= 1 && !u.trial_reminder_1d_sent),
    };
  });

  res.json({ usersInWindow: preview.length, preview });
});

export default router;
