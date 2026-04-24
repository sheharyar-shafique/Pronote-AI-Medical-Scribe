import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  UserCheck,
  Plug,
  ShieldCheck,
  Star,
  Send,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lock,
  Zap,
  Clock,
  UploadCloud,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

// ── Integration cards ────────────────────────────────────────────────────────
const INTEGRATIONS = [
  { name: 'Epic', logo: '🏥', category: 'EHR', status: 'available', description: 'Full bidirectional sync with Epic MyChart & Hyperspace.' },
  { name: 'Cerner (Oracle Health)', logo: '💊', category: 'EHR', status: 'available', description: 'Automated note push to Cerner Millennium.' },
  { name: 'Allscripts', logo: '📋', category: 'EHR', status: 'available', description: 'Seamless Allscripts Professional EHR integration.' },
  { name: 'athenahealth', logo: '⚕️', category: 'EHR', status: 'available', description: 'Direct note delivery to athenaOne.' },
  { name: 'Meditech', logo: '🔬', category: 'EHR', status: 'available', description: 'Meditech Expanse & MAGIC compatibility.' },
  { name: 'HL7 / FHIR API', logo: '🔗', category: 'API', status: 'available', description: 'Standards-based FHIR R4 REST API for any system.' },
  { name: 'Slack', logo: '💬', category: 'Productivity', status: 'coming_soon', description: 'Team notifications and note summaries in Slack.' },
  { name: 'Microsoft Teams', logo: '🟦', category: 'Productivity', status: 'coming_soon', description: 'Note alerts and team updates via Teams.' },
];

// ── SLA tiers ────────────────────────────────────────────────────────────────
const SLA_ITEMS = [
  { metric: 'Uptime Guarantee', value: '99.9%', icon: <Zap size={18} className="text-emerald-400" />, description: 'Monthly uptime SLA with automatic credits if breached.' },
  { metric: 'Support Response', value: '< 4 hours', icon: <Clock size={18} className="text-blue-400" />, description: 'Dedicated priority queue — guaranteed first response within 4 business hours.' },
  { metric: 'Incident Resolution', value: '< 24 hours', icon: <ShieldCheck size={18} className="text-violet-400" />, description: 'Critical issues resolved within 24 hours with status updates every 2 hours.' },
  { metric: 'Data Backup RPO', value: '1 hour', icon: <UploadCloud size={18} className="text-amber-400" />, description: 'Recovery Point Objective — never lose more than 1 hour of data.' },
];

export default function EnterprisePage() {
  const { user } = useAuthStore();
  const isGroupAnnual = user?.subscriptionPlan === 'group_annual';

  const [aiForm, setAiForm] = useState({ specialty: '', terminology: '', examples: '' });
  const [aiSubmitted, setAiSubmitted] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [intReqOpen, setIntReqOpen] = useState<string | null>(null);
  const [intReqSent, setIntReqSent] = useState<Set<string>>(new Set());

  const [slaOpen, setSlaOpen] = useState<number | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAiSubmit = async () => {
    if (!aiForm.specialty.trim()) { toast.error('Specialty is required'); return; }
    if (!aiForm.terminology.trim()) { toast.error('Please provide some custom terminology'); return; }
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 1200)); // simulate API call
    setAiLoading(false);
    setAiSubmitted(true);
    toast.success('Custom AI training request submitted! Our team will process it within 3–5 business days.');
  };

  const handleIntRequest = (name: string) => {
    setIntReqSent(prev => new Set(prev).add(name));
    setIntReqOpen(null);
    toast.success(`Integration request for ${name} sent! Your success manager will follow up.`);
  };

  // ── Plan gate banner ──────────────────────────────────────────────────────
  const PlanGate = ({ feature }: { feature: string }) =>
    !isGroupAnnual ? (
      <div className="mb-6 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
        <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-400 font-bold text-sm">{feature} — Group Annual Plan Required</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Upgrade to <strong className="text-white">Group Annual ($460/year)</strong> to unlock this feature.{' '}
            <a href="/settings" className="text-emerald-400 underline hover:text-emerald-300">Upgrade now →</a>
          </p>
        </div>
      </div>
    ) : null;

  return (
    <Sidebar>
      <div className="relative min-h-screen overflow-x-hidden">
        {/* BG glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-5xl mx-auto">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Star size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Enterprise Features
                </h1>
                <p className="text-slate-400 text-sm">Exclusive tools included in your Group Annual plan</p>
              </div>
            </div>
            {!isGroupAnnual && (
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center gap-3">
                <Lock size={18} className="text-amber-400 shrink-0" />
                <p className="text-sm text-amber-300">
                  These features require the <strong className="text-white">Group Annual</strong> plan.{' '}
                  <a href="/settings" className="text-emerald-400 underline hover:text-emerald-300">Upgrade now →</a>
                </p>
              </div>
            )}
          </motion.div>

          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-10">

            {/* ══════════════════════════════════════════════════════════════
                1. CUSTOM AI TRAINING
            ══════════════════════════════════════════════════════════════ */}
            <motion.section variants={fadeUp}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Brain size={17} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Custom AI Training</h2>
                  <p className="text-slate-400 text-xs">Train the AI on your specialty-specific terminology and phrasing</p>
                </div>
              </div>

              <PlanGate feature="Custom AI Training" />

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                {aiSubmitted ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
                      <CheckCircle size={28} className="text-emerald-400" />
                    </div>
                    <p className="text-white font-bold mb-1">Training Request Received!</p>
                    <p className="text-slate-400 text-sm max-w-sm">
                      Our AI team will review your terminology and deploy a custom model tuned to your practice within <strong className="text-white">3–5 business days</strong>.
                    </p>
                    <button
                      onClick={() => setAiSubmitted(false)}
                      className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Submit another request
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid sm:grid-cols-3 gap-4 mb-2">
                      {[
                        { icon: '🎯', label: 'Specialty Vocabulary', desc: 'Medical terms specific to your field' },
                        { icon: '✍️', label: 'Preferred Phrasing', desc: 'How you like notes structured' },
                        { icon: '⚡', label: 'Auto-corrections', desc: 'Common transcription fixes' },
                      ].map((item, i) => (
                        <div key={i} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-center">
                          <span className="text-2xl">{item.icon}</span>
                          <p className="text-white text-xs font-bold mt-1">{item.label}</p>
                          <p className="text-slate-500 text-xs">{item.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Your Specialty *
                      </label>
                      <input
                        value={aiForm.specialty}
                        onChange={e => setAiForm(f => ({ ...f, specialty: e.target.value }))}
                        placeholder="e.g. Interventional Cardiology, Pediatric Neurology…"
                        disabled={!isGroupAnnual}
                        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Custom Terminology *
                      </label>
                      <textarea
                        value={aiForm.terminology}
                        onChange={e => setAiForm(f => ({ ...f, terminology: e.target.value }))}
                        placeholder="List specialty-specific terms, abbreviations, drug names, or procedures — one per line. e.g.:&#10;TAVI (Transcatheter Aortic Valve Implantation)&#10;FFR (Fractional Flow Reserve)&#10;IVUS"
                        rows={5}
                        disabled={!isGroupAnnual}
                        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Phrasing Preferences <span className="text-slate-600 normal-case">(optional)</span>
                      </label>
                      <textarea
                        value={aiForm.examples}
                        onChange={e => setAiForm(f => ({ ...f, examples: e.target.value }))}
                        placeholder="Describe how you prefer notes to be formatted or phrased. e.g.: 'Always spell out medication names fully', 'Use past tense for history', 'Include laterality (left/right) explicitly'"
                        rows={3}
                        disabled={!isGroupAnnual}
                        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    <button
                      onClick={handleAiSubmit}
                      disabled={!isGroupAnnual || aiLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {aiLoading ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                      ) : (
                        <><Send size={15} /> Submit Training Request</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.section>

            {/* ══════════════════════════════════════════════════════════════
                2. DEDICATED SUCCESS MANAGER
            ══════════════════════════════════════════════════════════════ */}
            <motion.section variants={fadeUp}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <UserCheck size={17} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Dedicated Success Manager</h2>
                  <p className="text-slate-400 text-xs">Your personal point of contact for onboarding, training, and strategy</p>
                </div>
              </div>

              <PlanGate feature="Dedicated Success Manager" />

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                {isGroupAnnual ? (
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    {/* Manager card */}
                    <div className="flex-shrink-0 w-full sm:w-56 p-5 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mx-auto mb-3 text-2xl shadow-lg shadow-blue-500/30">
                        👨‍💼
                      </div>
                      <p className="text-white font-bold text-sm">Alex Morgan</p>
                      <p className="text-slate-400 text-xs mt-0.5">Enterprise Success Manager</p>
                      <div className="mt-3 space-y-2">
                        <a
                          href="mailto:success@pronote.ai"
                          className="flex items-center justify-center gap-1.5 w-full py-2 bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-semibold rounded-xl hover:bg-blue-500/25 transition-all"
                        >
                          <Send size={12} /> Email Me
                        </a>
                        <a
                          href="https://calendly.com/pronote-success"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 w-full py-2 bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold rounded-xl hover:bg-white/10 transition-all"
                        >
                          <ExternalLink size={12} /> Book a Call
                        </a>
                      </div>
                    </div>

                    {/* Services list */}
                    <div className="flex-1 space-y-3">
                      <p className="text-slate-300 text-sm mb-4">
                        Your dedicated success manager is here to help you get the most out of Pronote. They handle everything from initial setup to ongoing optimization.
                      </p>
                      {[
                        { icon: '🚀', title: 'Onboarding & Setup', desc: 'Guided setup, team training sessions, and workflow optimization.' },
                        { icon: '🎓', title: 'Staff Training', desc: 'Live training sessions for your entire clinical team.' },
                        { icon: '📊', title: 'Quarterly Business Reviews', desc: 'Usage analytics review and ROI reporting every quarter.' },
                        { icon: '🔧', title: 'Custom Configuration', desc: 'Help configuring templates, integrations, and AI settings.' },
                        { icon: '📞', title: 'Escalation Priority', desc: 'Direct escalation path bypassing standard support queues.' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl">
                          <span className="text-lg flex-shrink-0">{item.icon}</span>
                          <div>
                            <p className="text-white text-sm font-semibold">{item.title}</p>
                            <p className="text-slate-500 text-xs">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center opacity-50">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-3 text-3xl">👨‍💼</div>
                    <p className="text-white font-bold mb-1">Dedicated Success Manager</p>
                    <p className="text-slate-400 text-sm max-w-sm">Upgrade to Group Annual to get a personal success manager assigned to your account.</p>
                  </div>
                )}
              </div>
            </motion.section>

            {/* ══════════════════════════════════════════════════════════════
                3. CUSTOM INTEGRATIONS
            ══════════════════════════════════════════════════════════════ */}
            <motion.section variants={fadeUp}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Plug size={17} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Custom Integrations</h2>
                  <p className="text-slate-400 text-xs">Connect Pronote with your existing EHR and practice management systems</p>
                </div>
              </div>

              <PlanGate feature="Custom Integrations" />

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {INTEGRATIONS.map((intg) => (
                  <div key={intg.name} className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3 hover:border-white/20 transition-all">
                    {intg.status === 'coming_soon' && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">
                        SOON
                      </span>
                    )}
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{intg.logo}</span>
                      <div>
                        <p className="text-white text-sm font-bold leading-tight">{intg.name}</p>
                        <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">{intg.category}</span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed flex-1">{intg.description}</p>
                    {intg.status === 'available' ? (
                      intReqSent.has(intg.name) ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                          <CheckCircle size={13} /> Request Sent
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => isGroupAnnual && setIntReqOpen(intg.name)}
                            disabled={!isGroupAnnual}
                            className="w-full py-2 bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-bold rounded-xl hover:bg-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Request Setup
                          </button>
                          {intReqOpen === intg.name && (
                            <div className="mt-2 p-3 bg-slate-800 border border-white/10 rounded-xl space-y-2">
                              <p className="text-white text-xs font-semibold">Confirm integration request for <span className="text-amber-400">{intg.name}</span>?</p>
                              <p className="text-slate-500 text-xs">Your success manager will contact you within 2 business days to begin setup.</p>
                              <div className="flex gap-2">
                                <button onClick={() => setIntReqOpen(null)} className="flex-1 py-1.5 border border-white/10 text-slate-400 text-xs rounded-lg hover:bg-white/5">Cancel</button>
                                <button onClick={() => handleIntRequest(intg.name)} className="flex-1 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-500/30">Confirm</button>
                              </div>
                            </div>
                          )}
                        </>
                      )
                    ) : (
                      <span className="text-xs text-slate-600 font-medium">Coming soon</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>

            {/* ══════════════════════════════════════════════════════════════
                4. SLA GUARANTEES
            ══════════════════════════════════════════════════════════════ */}
            <motion.section variants={fadeUp}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <ShieldCheck size={17} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">SLA Guarantees</h2>
                  <p className="text-slate-400 text-xs">Contractual service level agreements for your practice</p>
                </div>
              </div>

              <PlanGate feature="SLA Guarantees" />

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                {/* SLA metrics */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                  {SLA_ITEMS.map((item, i) => (
                    <div key={i} className={`p-5 text-center ${!isGroupAnnual ? 'opacity-50' : ''}`}>
                      <div className="flex justify-center mb-2">{item.icon}</div>
                      <p className="text-2xl font-black text-white">{item.value}</p>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">{item.metric}</p>
                    </div>
                  ))}
                </div>

                {/* Accordion details */}
                <div className="border-t border-white/[0.06] divide-y divide-white/[0.05]">
                  {SLA_ITEMS.map((item, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setSlaOpen(slaOpen === i ? null : i)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span className="text-sm font-semibold text-white">{item.metric}</span>
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{item.value}</span>
                        </div>
                        {slaOpen === i ? (
                          <ChevronUp size={16} className="text-slate-500" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-500" />
                        )}
                      </button>
                      {slaOpen === i && (
                        <div className="px-6 pb-4 text-sm text-slate-400 leading-relaxed">
                          {item.description}
                          {!isGroupAnnual && (
                            <span className="ml-2 text-amber-400 text-xs">
                              (Upgrade to Group Annual to activate)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* SLA document download */}
                {isGroupAnnual && (
                  <div className="border-t border-white/[0.06] p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-white font-bold text-sm">SLA Agreement Document</p>
                      <p className="text-slate-400 text-xs">Download your full SLA for legal and compliance records</p>
                    </div>
                    <button
                      onClick={() => toast.success('SLA document download initiated!')}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-bold rounded-xl hover:bg-violet-500/25 transition-all flex-shrink-0"
                    >
                      <ExternalLink size={13} /> Download SLA
                    </button>
                  </div>
                )}
              </div>
            </motion.section>

          </motion.div>
        </div>
      </div>
    </Sidebar>
  );
}
