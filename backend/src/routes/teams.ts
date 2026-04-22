import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireActiveSubscription, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendTeamInviteEmail } from '../lib/mailer.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);
router.use(requireActiveSubscription);

// ── Helpers ──────────────────────────────────────────────────────────────────

const GROUP_PLANS = ['group_monthly', 'group_annual'];
const MAX_MEMBERS: Record<string, number> = {
  group_monthly: 5,
  group_annual: 999, // unlimited
};

async function getTeamByOwner(ownerId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', ownerId)
    .single();
  return { data, error };
}

async function getTeamByMember(userId: string) {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, teams(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return { data, error };
}

// ── GET /api/teams  ── get current user's team (as owner or member) ──────────
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Check if owner
    const { data: ownedTeam } = await getTeamByOwner(userId);

    const teamId = ownedTeam?.id;
    if (!teamId) {
      // Maybe a member of someone else's team
      const { data: membership } = await getTeamByMember(userId);
      if (!membership) {
        return res.json(null); // not in any team
      }
      const team = (membership as Record<string, unknown>).teams as Record<string, unknown>;
      const { data: members } = await supabase
        .from('team_members')
        .select('id, user_id, role, status, invited_email, joined_at, users(name, email, specialty)')
        .eq('team_id', team.id);

      return res.json({
        id: team.id,
        name: team.name,
        ownerId: team.owner_id,
        memberLimit: team.member_limit,
        plan: team.plan,
        isOwner: false,
        members: (members || []).map(formatMember),
      });
    }

    // Load members
    const { data: members } = await supabase
      .from('team_members')
      .select('id, user_id, role, status, invited_email, joined_at, users(name, email, specialty)')
      .eq('team_id', teamId);

    return res.json({
      id: ownedTeam.id,
      name: ownedTeam.name,
      ownerId: ownedTeam.owner_id,
      memberLimit: ownedTeam.member_limit,
      plan: ownedTeam.plan,
      isOwner: true,
      members: (members || []).map(formatMember),
    });
  } catch (error) {
    next(error);
  }
});

function formatMember(m: Record<string, unknown>) {
  const user = m.users as Record<string, string> | null;
  return {
    id: m.id,
    userId: m.user_id,
    role: m.role,
    status: m.status,
    invitedEmail: m.invited_email,
    joinedAt: m.joined_at,
    name: user?.name || null,
    email: user?.email || (m.invited_email as string),
    specialty: user?.specialty || null,
  };
}

// ── POST /api/teams  ── create a team (owner only, once per user) ─────────────
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (!name?.trim()) throw new AppError('Team name is required', 400);

    // Check plan
    const { data: user } = await supabase
      .from('users')
      .select('subscription_plan')
      .eq('id', userId)
      .single();

    if (!user || !GROUP_PLANS.includes(user.subscription_plan)) {
      throw new AppError('Team features require a Group plan', 403);
    }

    // Only one team per owner
    const { data: existing } = await getTeamByOwner(userId);
    if (existing) throw new AppError('You already have a team', 400);

    const limit = MAX_MEMBERS[user.subscription_plan] || 5;

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        owner_id: userId,
        name: name.trim(),
        plan: user.subscription_plan,
        member_limit: limit,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: team.id,
      name: team.name,
      ownerId: team.owner_id,
      memberLimit: team.member_limit,
      plan: team.plan,
      isOwner: true,
      members: [],
    });
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/teams/:id  ── rename team ────────────────────────────────────────
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) throw new AppError('Team name required', 400);

    const { data: team, error } = await supabase
      .from('teams')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('owner_id', req.user!.id)
      .select()
      .single();

    if (error || !team) throw new AppError('Team not found or not authorized', 404);
    res.json({ id: team.id, name: team.name });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/teams/:id/invite  ── invite a member by email ──────────────────
router.post('/:id/invite', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email?.trim()) throw new AppError('Email is required', 400);

    // Must be owner
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .eq('owner_id', req.user!.id)
      .single();

    if (teamErr || !team) throw new AppError('Team not found or not authorized', 404);

    // Count active + pending members
    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', id)
      .in('status', ['active', 'pending']);

    if ((count || 0) >= team.member_limit) {
      throw new AppError(`Seat limit reached (${team.member_limit} members max on your plan)`, 403);
    }

    // Already invited?
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', id)
      .eq('invited_email', email.toLowerCase())
      .single();

    if (existing) throw new AppError('This email has already been invited', 400);

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Find existing user
    const { data: invitedUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    const { data: member, error: insertErr } = await supabase
      .from('team_members')
      .insert({
        team_id: id,
        user_id: invitedUser?.id || null,
        invited_email: email.toLowerCase(),
        role: 'member',
        status: 'pending',
        invite_token: token,
        invite_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Send invite email
    const inviteUrl = `${process.env.FRONTEND_URL?.split(',')[0]}/team/accept?token=${token}`;
    try {
      await sendTeamInviteEmail(email.toLowerCase(), team.name, req.user!.email, inviteUrl);
    } catch (mailErr) {
      console.error('Failed to send invite email:', mailErr);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      id: member.id,
      invitedEmail: member.invited_email,
      status: member.status,
      role: member.role,
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/teams/accept  ── accept an invite via token ─────────────────────
router.post('/accept', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { token } = req.body;
    if (!token) throw new AppError('Token is required', 400);

    const { data: member, error } = await supabase
      .from('team_members')
      .select('*, teams(name)')
      .eq('invite_token', token)
      .eq('status', 'pending')
      .single();

    if (error || !member) throw new AppError('Invalid or expired invite link', 404);

    if (new Date(member.invite_expires_at) < new Date()) {
      throw new AppError('This invite link has expired', 410);
    }

    // Update membership
    await supabase
      .from('team_members')
      .update({
        status: 'active',
        user_id: req.user!.id,
        invite_token: null,
        joined_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    const team = member.teams as Record<string, string>;
    res.json({ message: `Welcome to ${team?.name}!`, teamId: member.team_id });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/teams/:id/members/:memberId  ── remove a member ───────────────
router.delete('/:id/members/:memberId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user!.id;

    // Owner can remove anyone; members can remove themselves
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', id)
      .single();

    const isOwner = team?.owner_id === userId;

    const { data: member } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('team_id', id)
      .single();

    if (!member) throw new AppError('Member not found', 404);

    const isSelf = member.user_id === userId;

    if (!isOwner && !isSelf) {
      throw new AppError('Not authorized to remove this member', 403);
    }

    await supabase.from('team_members').delete().eq('id', memberId);
    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/teams/:id  ── disband team (owner only) ──────────────────────
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await supabase.from('team_members').delete().eq('team_id', id);
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id)
      .eq('owner_id', req.user!.id);
    if (error) throw new AppError('Team not found or not authorized', 404);
    res.json({ message: 'Team disbanded' });
  } catch (error) {
    next(error);
  }
});

export default router;
