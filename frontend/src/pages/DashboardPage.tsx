import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Mic, MessageSquare, Upload, FileText, Clock,
  TrendingUp, Calendar, ChevronRight, Plus, LayoutTemplate,
  Sparkles, ArrowUpRight, Activity
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useAuthStore, useNotesStore } from '../store';
import { format } from 'date-fns';
import { dashboardApi, DashboardStats, Appointment } from '../services/api';

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { notes, fetchNotes } = useNotesStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
    const load = async () => {
      try {
        setStatsLoading(true);
        const [s, a] = await Promise.all([dashboardApi.getStats(), dashboardApi.getAppointments()]);
        setStats(s);
        setAppointments(a);
      } catch (e) {
        console.error(e);
      } finally {
        setStatsLoading(false);
      }
    };
    load();
  }, [fetchNotes]);

  const recentNotes = notes.slice(0, 5);

  const statCards = [
    { label: 'Total Notes', value: statsLoading ? '—' : (stats?.totalNotes?.toString() || '0'), icon: <FileText size={20} />, gradient: 'from-emerald-400 to-teal-500', glow: 'rgba(16,185,129,0.2)', change: '+12%' },
    { label: 'This Week', value: statsLoading ? '—' : (stats?.notesThisWeek?.toString() || '0'), icon: <Calendar size={20} />, gradient: 'from-blue-400 to-indigo-500', glow: 'rgba(59,130,246,0.2)', change: '+8%' },
    { label: 'Avg. Time', value: statsLoading ? '—' : (stats?.averageTime || 'N/A'), icon: <Clock size={20} />, gradient: 'from-violet-400 to-purple-500', glow: 'rgba(139,92,246,0.2)', change: '-15%' },
    { label: 'Accuracy', value: statsLoading ? '—' : (stats?.accuracy || 'N/A'), icon: <TrendingUp size={20} />, gradient: 'from-amber-400 to-orange-500', glow: 'rgba(251,191,36,0.2)', change: '+2%' },
  ];

  const quickActions = [
    { icon: <Mic size={22} />, title: 'Capture', desc: 'Record visit', href: '/capture', gradient: 'from-emerald-400 to-teal-500', glow: 'rgba(16,185,129,0.25)' },
    { icon: <MessageSquare size={22} />, title: 'Dictation', desc: 'Dictate notes', href: '/dictation', gradient: 'from-violet-400 to-purple-500', glow: 'rgba(139,92,246,0.25)' },
    { icon: <Upload size={22} />, title: 'Upload', desc: 'Upload audio', href: '/upload', gradient: 'from-blue-400 to-indigo-500', glow: 'rgba(59,130,246,0.25)' },
    { icon: <FileText size={22} />, title: 'Notes', desc: 'Browse all', href: '/notes', gradient: 'from-rose-400 to-pink-500', glow: 'rgba(244,63,94,0.25)' },
    { icon: <LayoutTemplate size={22} />, title: 'Templates', desc: 'Manage templates', href: '/templates', gradient: 'from-amber-400 to-orange-500', glow: 'rgba(251,191,36,0.25)' },
  ];

  const statusConfig: Record<string, { color: string; bg: string; dot: string }> = {
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
    draft:     { color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20',   dot: 'bg-amber-400'   },
    pending:   { color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20',    dot: 'bg-blue-400'    },
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen overflow-x-hidden">
        {/* Background glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(52,211,153,1) 1px,transparent 1px),linear-gradient(90deg,rgba(52,211,153,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-7xl mx-auto">

          {/* ── Welcome Header ── */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Sparkles size={17} className="text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Welcome back, <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0] || 'Doctor'}</span>! 👋
                </h1>
              </div>
              <p className="text-slate-500 ml-12 text-sm">Here's your clinical documentation overview for today.</p>
            </div>
            <Link to="/capture">
              <motion.button whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(16,185,129,0.35)' }} whileTap={{ scale: 0.97 }}
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/25">
                <Plus size={16} /> New Note
              </motion.button>
            </Link>
          </motion.div>

          {/* ── Stats Cards ── */}
          <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat, i) => (
              <motion.div key={i} variants={fadeUp}>
                <div className="group relative overflow-hidden bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:border-white/20 hover:-translate-y-1 transition-all duration-300"
                  style={{ boxShadow: `0 0 0 0 ${stat.glow}` }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 8px 32px ${stat.glow}`)}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 0 0 ${stat.glow}`)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                      {stat.icon}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                      <Activity size={10} /> {stat.change}
                    </span>
                  </div>
                  <p className="text-3xl font-black text-white mb-0.5">{stat.value}</p>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                  <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.07] blur-xl transition-opacity duration-300`} />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Quick Actions ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Quick Actions</h2>
              <span className="text-xs text-slate-500">Launch any workflow instantly</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {quickActions.map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.07 }}>
                  <Link to={a.href}>
                    <div className="group relative overflow-hidden bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 text-center hover:border-white/20 hover:-translate-y-2 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer"
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 12px 40px ${a.glow}`)}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.gradient} flex items-center justify-center text-white mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                        {a.icon}
                      </div>
                      <h3 className="font-bold text-white text-sm mb-0.5 group-hover:text-emerald-400 transition-colors">{a.title}</h3>
                      <p className="text-xs text-slate-500">{a.desc}</p>
                      <div className={`absolute inset-0 bg-gradient-to-br ${a.gradient} opacity-0 group-hover:opacity-[0.04] rounded-2xl transition-opacity duration-300`} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── Bottom Grid: Recent Notes + Appointments ── */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Recent Notes Table */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Recent Clinical Notes</h2>
                <Link to="/notes" className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                  View All <ChevronRight size={15} />
                </Link>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 px-5 py-3 border-b border-white/[0.06]">
                  <span className="col-span-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Patient</span>
                  <span className="col-span-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Date</span>
                  <span className="col-span-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Type</span>
                  <span className="col-span-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                  <span className="col-span-1" />
                </div>

                {recentNotes.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <FileText size={24} className="text-slate-600" />
                    </div>
                    <p className="text-slate-500 text-sm">No notes yet</p>
                    <Link to="/capture">
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className="mt-4 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold rounded-xl hover:bg-emerald-500/30 transition-all">
                        Create First Note
                      </motion.button>
                    </Link>
                  </div>
                ) : (
                  recentNotes.map((note: any, i: number) => {
                    const s = statusConfig[note.status] || statusConfig.pending;
                    return (
                      <motion.div key={note.id || i}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.06 }}
                        className="group grid grid-cols-12 items-center px-5 py-4 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors">
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                            {note.patientName?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <span className="text-white text-sm font-medium truncate">{note.patientName || 'Unknown Patient'}</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-slate-400 text-sm">{format(new Date(note.dateOfService), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 text-sm capitalize">{note.template}</span>
                        </div>
                        <div className="col-span-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${s.bg} ${s.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {note.status}
                          </span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Link to={`/notes/${note.id}`}>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-all">
                              <ArrowUpRight size={13} />
                            </motion.button>
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>

            {/* Appointments Panel */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Upcoming Today</h2>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                  {appointments.length} scheduled
                </span>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                {statsLoading ? (
                  <div className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto" />
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="py-12 text-center px-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Calendar size={24} className="text-slate-600" />
                    </div>
                    <p className="text-slate-500 text-sm">No appointments today</p>
                    <p className="text-slate-600 text-xs mt-1">Enjoy a lighter schedule!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {appointments.map((appt, i) => (
                      <div key={appt.id || i} className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors">
                        <div className="w-14 text-center flex-shrink-0">
                          <p className="text-sm font-bold text-white">{appt.time.split(' ')[0]}</p>
                          <p className="text-xs text-slate-500">{appt.time.split(' ')[1]}</p>
                        </div>
                        <div className="w-px h-8 bg-emerald-500/30 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{appt.patient}</p>
                          <p className="text-xs text-slate-500 truncate">{appt.type}</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Trial banner if on trial */}
                {user?.subscriptionStatus === 'trial' && (
                  <div className="m-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/20">
                    <p className="text-xs font-bold text-emerald-400 mb-1">🎉 Trial Active</p>
                    <p className="text-xs text-slate-400 mb-3">Your free trial ends soon. Upgrade to keep your access.</p>
                    <Link to="/settings">
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/25">
                        Choose a Plan →
                      </motion.button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>

        {/* Mobile FAB */}
        <Link to="/capture" className="lg:hidden fixed bottom-6 right-6 z-50">
          <motion.button whileHover={{ scale: 1.08, boxShadow: '0 0 30px rgba(16,185,129,0.5)' }} whileTap={{ scale: 0.93 }}
            className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40">
            <Plus size={24} />
          </motion.button>
        </Link>
      </div>
    </Sidebar>
  );
}
