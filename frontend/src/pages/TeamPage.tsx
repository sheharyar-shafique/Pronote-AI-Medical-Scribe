import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Mail,
  Crown,
  Clock,
  CheckCircle2,
  Trash2,
  Plus,
  Shield,
  AlertCircle,
  Copy,
  Pencil,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Modal, Input } from '../components/ui';
import { teamsApi } from '../services/api';
import { useAuthStore } from '../store';
import type { Team, TeamMember } from '../services/api';
import toast from 'react-hot-toast';

export default function TeamPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDisbandOpen, setIsDisbandOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Load team ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadTeam();
  }, []);

  // ── Auto-accept invite from email link ──────────────────────────────────────
  useEffect(() => {
    if (inviteToken) handleAcceptInvite(inviteToken);
  }, [inviteToken]);

  const loadTeam = async () => {
    try {
      const data = await teamsApi.get();
      setTeam(data);
    } catch {
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreateTeam = async () => {
    if (!teamName.trim()) { toast.error('Team name is required'); return; }
    setSaving(true);
    try {
      const created = await teamsApi.create(teamName.trim());
      setTeam(created);
      setIsCreateOpen(false);
      setTeamName('');
      toast.success('Team created! Start inviting members.');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to create team');
    } finally { setSaving(false); }
  };

  const handleInvite = async () => {
    if (!team || !inviteEmail.trim()) { toast.error('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error('Enter a valid email address'); return;
    }
    setSaving(true);
    try {
      const member = await teamsApi.invite(team.id, inviteEmail.trim());
      setTeam(prev => prev ? { ...prev, members: [...prev.members, member] } : prev);
      setIsInviteOpen(false);
      setInviteEmail('');
      toast.success('Invite sent! They will receive an email.');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to send invite');
    } finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!team || !renameValue.trim()) return;
    setSaving(true);
    try {
      await teamsApi.rename(team.id, renameValue.trim());
      setTeam(prev => prev ? { ...prev, name: renameValue.trim() } : prev);
      setIsRenameOpen(false);
      toast.success('Team renamed');
    } catch { toast.error('Failed to rename team'); }
    finally { setSaving(false); }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!team) return;
    if (!confirm(`Remove ${member.name || member.email} from the team?`)) return;
    try {
      await teamsApi.removeMember(team.id, member.id);
      setTeam(prev => prev
        ? { ...prev, members: prev.members.filter(m => m.id !== member.id) }
        : prev
      );
      toast.success('Member removed');
    } catch { toast.error('Failed to remove member'); }
  };

  const handleDisband = async () => {
    if (!team) return;
    setSaving(true);
    try {
      await teamsApi.disband(team.id);
      setTeam(null);
      setIsDisbandOpen(false);
      toast.success('Team disbanded');
    } catch { toast.error('Failed to disband team'); }
    finally { setSaving(false); }
  };

  const handleAcceptInvite = async (token: string) => {
    try {
      await teamsApi.accept(token);
      toast.success('You joined the team!');
      loadTeam();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Invite link is invalid or expired');
    }
  };

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/team?token=${token}`);
    toast.success('Invite link copied!');
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeCount  = team?.members.filter(m => m.status === 'active').length ?? 0;
  const pendingCount = team?.members.filter(m => m.status === 'pending').length ?? 0;
  const seatsFull    = team ? (activeCount + pendingCount) >= team.memberLimit : false;
  const isGroupPlan  = user?.subscriptionPlan?.startsWith('group');

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <div className="relative min-h-screen">
        {/* BG glows */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-5xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Users size={17} className="text-white" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Team Management</h1>
                </div>
                <p className="text-slate-400 ml-12 text-sm">Invite colleagues, manage seats, and collaborate on notes</p>
              </div>

              {team && team.isOwner && (
                <div className="flex gap-2 self-start md:self-auto">
                  <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setRenameValue(team.name); setIsRenameOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold rounded-xl transition-all"
                  >
                    <Pencil size={14} /> Rename
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(139,92,246,0.35)' }} whileTap={{ scale: 0.97 }}
                    onClick={() => setIsInviteOpen(true)}
                    disabled={seatsFull}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus size={16} /> Invite Member
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
            </div>
          )}

          {/* No Group Plan */}
          {!loading && !isGroupPlan && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-4">
                <Shield size={28} className="text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Group Plan Required</h2>
              <p className="text-slate-400 text-sm max-w-sm mb-6">
                Team management is available on the <strong className="text-amber-400">Group Monthly ($40)</strong> or <strong className="text-amber-400">Group Annual</strong> plans.
              </p>
              <a href="/settings" className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-amber-500/25 hover:opacity-90 transition-all">
                Upgrade Plan
              </a>
            </motion.div>
          )}

          {/* No Team Yet */}
          {!loading && isGroupPlan && !team && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center mb-4">
                <Users size={28} className="text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No Team Yet</h2>
              <p className="text-slate-400 text-sm max-w-sm mb-6">
                Create a team to start inviting colleagues and collaborating on clinical notes together.
              </p>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(139,92,246,0.35)' }} whileTap={{ scale: 0.97 }}
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-violet-500/25"
              >
                <Plus size={18} /> Create Your Team
              </motion.button>
            </motion.div>
          )}

          {/* Team Dashboard */}
          {!loading && team && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

              {/* Team Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Team Name', value: team.name, icon: Users, color: 'text-violet-400' },
                  { label: 'Seats Used', value: `${activeCount + pendingCount} / ${team.memberLimit}`, icon: Shield, color: seatsFull ? 'text-red-400' : 'text-emerald-400' },
                  { label: 'Active Members', value: activeCount, icon: CheckCircle2, color: 'text-emerald-400' },
                  { label: 'Pending Invites', value: pendingCount, icon: Clock, color: 'text-amber-400' },
                ].map((stat, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon size={14} className={stat.color} />
                      <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                    </div>
                    <p className="text-lg font-bold text-white truncate">{stat.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Seat limit warning */}
              {seatsFull && team.isOwner && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
                  <AlertCircle size={18} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">
                    All {team.memberLimit} seats are filled. Upgrade to <strong>Group Annual</strong> for unlimited members.
                  </p>
                </div>
              )}

              {/* Members List */}
              <div>
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Users size={16} className="text-violet-400" /> Members
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {team.members.map((member, idx) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        index={idx}
                        isOwner={team.isOwner}
                        currentUserId={user?.id || ''}
                        ownerId={team.ownerId}
                        onRemove={handleRemoveMember}
                        onCopyLink={copyInviteLink}
                      />
                    ))}
                  </AnimatePresence>

                  {team.members.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-white/10 rounded-2xl">
                      <Mail size={24} className="text-slate-600 mb-2" />
                      <p className="text-slate-500 text-sm">No members yet — invite your first colleague!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              {team.isOwner && (
                <div className="p-5 border border-red-500/20 rounded-2xl bg-red-500/5">
                  <h3 className="text-sm font-bold text-red-400 mb-1">Danger Zone</h3>
                  <p className="text-xs text-slate-500 mb-3">Disbanding the team removes all members permanently.</p>
                  <button onClick={() => setIsDisbandOpen(true)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold rounded-xl transition-all">
                    Disband Team
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* ── Modals ── */}

        {/* Create Team */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Your Team">
          <div className="space-y-4">
            <Input label="Team Name" value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g., Cardiology Associates" />
            <p className="text-xs text-slate-500">
              Your plan allows up to <strong className="text-white">5 members</strong>. You can invite them after creating the team.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                Cancel
              </button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleCreateTeam} disabled={saving}
                className="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-500/25 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</> : <><Plus size={14} />Create Team</>}
              </motion.button>
            </div>
          </div>
        </Modal>

        {/* Invite Member */}
        <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite Team Member">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/25 rounded-xl">
              <Mail size={13} className="text-violet-400 shrink-0" />
              <p className="text-xs text-violet-300">An invite email will be sent to this address automatically.</p>
            </div>
            <Input label="Email Address" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@clinic.com" />
            {team && (
              <p className="text-xs text-slate-500">
                {activeCount + pendingCount} of {team.memberLimit} seats used
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsInviteOpen(false)}
                className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                Cancel
              </button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleInvite} disabled={saving}
                className="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-500/25 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</> : <><UserPlus size={14} />Send Invite</>}
              </motion.button>
            </div>
          </div>
        </Modal>

        {/* Rename */}
        <Modal isOpen={isRenameOpen} onClose={() => setIsRenameOpen(false)} title="Rename Team">
          <div className="space-y-4">
            <Input label="New Team Name" value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="Enter new team name" />
            <div className="flex gap-3">
              <button onClick={() => setIsRenameOpen(false)}
                className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                Cancel
              </button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleRename} disabled={saving}
                className="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save'}
              </motion.button>
            </div>
          </div>
        </Modal>

        {/* Disband */}
        <Modal isOpen={isDisbandOpen} onClose={() => setIsDisbandOpen(false)} title="Disband Team?">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-xl">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">This will remove all members and cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsDisbandOpen(false)}
                className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                Cancel
              </button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleDisband} disabled={saving}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Disbanding…</> : <><Trash2 size={14} />Disband</>}
              </motion.button>
            </div>
          </div>
        </Modal>
      </div>
    </Sidebar>
  );
}

// ── MemberRow component ───────────────────────────────────────────────────────
interface MemberRowProps {
  member: TeamMember;
  index: number;
  isOwner: boolean;
  currentUserId: string;
  ownerId: string;
  onRemove: (m: TeamMember) => void;
  onCopyLink: (token: string) => void;
}

function MemberRow({ member, index, isOwner, currentUserId, ownerId, onRemove, onCopyLink }: MemberRowProps) {
  const isTeamOwner = member.userId === ownerId;
  const isSelf      = member.userId === currentUserId;
  const canRemove   = (isOwner && !isTeamOwner) || (isSelf && !isTeamOwner);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }} transition={{ delay: index * 0.04 }}
      className="flex items-center gap-4 p-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl hover:bg-white/[0.06] transition-all"
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
        isTeamOwner
          ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20'
          : member.status === 'active'
            ? 'bg-gradient-to-br from-violet-400/30 to-purple-500/30 border border-violet-500/20 text-violet-300'
            : 'bg-white/5 border border-white/10 text-slate-500'
      }`}>
        {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm font-semibold truncate">
            {member.name || member.email}
          </p>
          {isTeamOwner && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold rounded-full">
              <Crown size={10} /> Owner
            </span>
          )}
          {isSelf && !isTeamOwner && (
            <span className="px-2 py-0.5 bg-violet-500/15 border border-violet-500/25 text-violet-400 text-xs font-semibold rounded-full">You</span>
          )}
        </div>
        <p className="text-slate-500 text-xs truncate">{member.name ? member.email : 'Awaiting signup'}</p>
        {member.specialty && <p className="text-slate-600 text-xs">{member.specialty}</p>}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 shrink-0">
        {member.status === 'active' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">
            <CheckCircle2 size={11} /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
            <Clock size={11} /> Pending
          </span>
        )}

        {/* Copy invite link for pending */}
        {member.status === 'pending' && isOwner && (
          <button onClick={() => onCopyLink(member.id)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-violet-400"
            title="Copy invite link">
            <Copy size={14} />
          </button>
        )}

        {/* Remove */}
        {canRemove && (
          <button onClick={() => onRemove(member)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-600 hover:text-red-400"
            title="Remove member">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
