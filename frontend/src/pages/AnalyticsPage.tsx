import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, FileText, BarChart2,
  Calendar, Activity, Download,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { dashboardApi, AnalyticsData } from '../services/api';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  draft: '#f59e0b',
  pending: '#3b82f6',
  signed: '#6366f1',
};

const periodOptions: { label: string; value: 7 | 30 | 90 }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#10b981' }} className="font-bold">
          {p.name ? `${p.name}: ` : ''}{p.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dashboardApi.getAnalytics(period)
      .then(setData)
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [period]);

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Date', 'Notes Created'],
      ...data.notesOverTime.map(r => [r.date, r.count]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pronote-analytics-${period}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  const statCards = data ? [
    {
      label: `Notes (${period}d)`,
      value: data.total,
      icon: <FileText size={20} />,
      gradient: 'from-emerald-400 to-teal-500',
      glow: 'rgba(16,185,129,0.2)',
    },
    {
      label: 'Daily Average',
      value: data.dailyAvg,
      icon: <BarChart2 size={20} />,
      gradient: 'from-violet-400 to-purple-500',
      glow: 'rgba(139,92,246,0.2)',
    },
    {
      label: 'vs Previous Period',
      value: `${data.trend > 0 ? '+' : ''}${data.trend}%`,
      icon: data.trend >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />,
      gradient: data.trend >= 0 ? 'from-emerald-400 to-teal-500' : 'from-red-400 to-rose-500',
      glow: data.trend >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
    },
    {
      label: 'Templates Used',
      value: data.notesByTemplate.length,
      icon: <Calendar size={20} />,
      gradient: 'from-amber-400 to-orange-500',
      glow: 'rgba(251,191,36,0.2)',
    },
  ] : [];

  // Format X-axis date labels
  const formatDate = (d: string) => {
    try { return format(parseISO(d), period === 7 ? 'EEE' : period === 30 ? 'MMM d' : 'MMM d'); }
    catch { return d; }
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen overflow-x-hidden">
        {/* Background */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-7xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Activity size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Advanced Analytics</h1>
                <p className="text-slate-500 text-sm">Clinical documentation insights & trends</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Period selector */}
              <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
                {periodOptions.map(o => (
                  <button key={o.value} onClick={() => setPeriod(o.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      period === o.value
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                        : 'text-slate-500 hover:text-white'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <button onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl text-xs font-bold transition-all">
                <Download size={14} /> Export CSV
              </button>
            </div>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
            </div>
          ) : !data ? null : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}>
                    <div className="relative overflow-hidden bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5
                      hover:border-white/20 hover:-translate-y-1 transition-all duration-300 group"
                      style={{ boxShadow: `0 0 0 0 ${s.glow}` }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 8px 32px ${s.glow}`)}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 0 0 ${s.glow}`)}>
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                        {s.icon}
                      </div>
                      <p className="text-3xl font-black text-white mb-0.5">{s.value}</p>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{s.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Notes Over Time — Line Chart */}
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold text-white">Notes Over Time</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Daily note creation for the last {period} days</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <div className="w-3 h-0.5 bg-emerald-400 rounded" /> Notes
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.notesOverTime} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} interval={period === 90 ? 6 : period === 30 ? 4 : 0} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="count" name="Notes" stroke="#10b981" strokeWidth={2.5}
                      dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Bottom row: Template + Status + Day of Week */}
              <div className="grid lg:grid-cols-3 gap-6">

                {/* By Template — Bar Chart */}
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="lg:col-span-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                  <h2 className="text-base font-bold text-white mb-1">By Template</h2>
                  <p className="text-xs text-slate-500 mb-5">Most used note types</p>
                  {data.notesByTemplate.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.notesByTemplate} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Notes" radius={[0, 6, 6, 0]}>
                          {data.notesByTemplate.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </motion.div>

                {/* By Status — Pie Chart */}
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="lg:col-span-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                  <h2 className="text-base font-bold text-white mb-1">By Status</h2>
                  <p className="text-xs text-slate-500 mb-4">Note completion breakdown</p>
                  {data.notesByStatus.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No data yet</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={data.notesByStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                            paddingAngle={3} dataKey="value">
                            {data.notesByStatus.map((entry, i) => (
                              <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {data.notesByStatus.map((s, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full"
                              style={{ background: STATUS_COLORS[s.name] || COLORS[i % COLORS.length] }} />
                            <span className="text-slate-400 capitalize">{s.name}</span>
                            <span className="text-white font-bold">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>

                {/* Day of Week — Bar */}
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="lg:col-span-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                  <h2 className="text-base font-bold text-white mb-1">Busiest Days</h2>
                  <p className="text-xs text-slate-500 mb-5">Notes by day of week</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byDayOfWeek} margin={{ left: -30, right: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Notes" radius={[6, 6, 0, 0]}>
                        {data.byDayOfWeek.map((_, i) => (
                          <Cell key={i} fill={`rgba(99,102,241,${0.4 + (i % 3) * 0.2})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

              </div>
            </>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
