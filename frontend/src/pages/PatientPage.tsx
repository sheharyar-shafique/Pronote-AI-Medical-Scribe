import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Mic,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Brain,
  ClipboardList,
  BarChart2,
  Stethoscope,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useNotesStore } from '../store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { ClinicalNote } from '../types';

// ── Patient profile stored in localStorage per patient name ──────────────────
interface PatientProfile {
  pronoun: string;
  name: string;
  phone: string;
  email: string;
  dob: string;
}

const PRONOUNS = ['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Other'];
const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+92', flag: '🇵🇰', label: 'PK' },
  { code: '+91', flag: '🇮🇳', label: 'IN' },
  { code: '+61', flag: '🇦🇺', label: 'AU' },
  { code: '+49', flag: '🇩🇪', label: 'DE' },
];

function storageKey(name: string) {
  return `pronote_patient_${name.toLowerCase().replace(/\s+/g, '_')}`;
}

function loadProfile(name: string): PatientProfile {
  try {
    const raw = localStorage.getItem(storageKey(name));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { pronoun: 'He/Him', name, phone: '', email: '', dob: '' };
}

function saveProfile(profile: PatientProfile) {
  try {
    localStorage.setItem(storageKey(profile.name), JSON.stringify(profile));
  } catch {}
}

// ── Generate a readable summary from note content ────────────────────────────
function buildSummary(note: ClinicalNote): string[] {
  const { content, patientName } = note;
  const lines: string[] = [];
  const name = patientName || 'The patient';

  if (content.subjective) {
    const s = content.subjective.trim();
    lines.push(s.length > 180 ? s.slice(0, 180) + '…' : s);
  }
  if (content.objective) {
    const o = content.objective.trim();
    lines.push(o.length > 180 ? o.slice(0, 180) + '…' : o);
  }
  if (content.assessment) {
    lines.push(`${name} was assessed: ${content.assessment.trim().slice(0, 150)}`);
  }
  if (content.instructions) {
    lines.push(`${name} was instructed to ${content.instructions.trim().slice(0, 150)}`);
  } else if (content.plan) {
    lines.push(`Plan: ${content.plan.trim().slice(0, 150)}`);
  }

  if (lines.length === 0) {
    lines.push('No summary content available from the last note.');
  }
  return lines;
}

// ── Tabs definition ───────────────────────────────────────────────────────────
type Tab = 'overview' | 'notes' | 'context' | 'treatment' | 'reports';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <User size={15} /> },
  { id: 'notes', label: 'Patient Notes', icon: <FileText size={15} /> },
  { id: 'context', label: 'Patient Context', icon: <Brain size={15} /> },
  { id: 'treatment', label: 'Treatment Plan', icon: <Stethoscope size={15} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart2 size={15} /> },
];

export default function PatientPage() {
  const { patientName: encodedName } = useParams<{ patientName: string }>();
  const navigate = useNavigate();
  const { notes } = useNotesStore();

  const patientName = decodeURIComponent(encodedName || '');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [profile, setProfile] = useState<PatientProfile>(loadProfile(patientName));
  const [isDirty, setIsDirty] = useState(false);
  const [showPronounMenu, setShowPronounMenu] = useState(false);
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const pronounRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);

  // Patient's notes sorted by most recent
  const patientNotes = notes
    .filter(n => n.patientName.toLowerCase() === patientName.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const lastNote = patientNotes[0] ?? null;
  const summaryLines = lastNote ? buildSummary(lastNote) : [];

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pronounRef.current && !pronounRef.current.contains(e.target as Node)) setShowPronounMenu(false);
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setShowCountryMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateField = (field: keyof PatientProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    saveProfile(profile);
    setIsDirty(false);
    toast.success('Patient profile saved');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Patient header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {patientName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{patientName}</h1>
              <p className="text-sm text-slate-400">{profile.pronoun} · {patientNotes.length} note{patientNotes.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Save size={15} />
                Save
              </motion.button>
            )}
            <button
              onClick={() => navigate('/capture')}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-900/30"
            >
              <Mic size={15} />
              New Conversation
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="border-b border-white/10 mb-6 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-white text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'overview' && (
              <div className="space-y-5">

                {/* Profile Form Card */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-6">

                  {/* Pronoun & Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Pronoun and Name</label>
                    <div className="flex gap-3">
                      {/* Pronoun picker */}
                      <div ref={pronounRef} className="relative">
                        <button
                          onClick={() => setShowPronounMenu(v => !v)}
                          className="flex items-center gap-1.5 px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                        >
                          {profile.pronoun}
                          <ChevronDown size={13} className="text-slate-400" />
                        </button>
                        <AnimatePresence>
                          {showPronounMenu && (
                            <motion.ul
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="absolute top-full mt-1 left-0 z-50 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-[120px]"
                            >
                              {PRONOUNS.map(p => (
                                <li key={p}>
                                  <button
                                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                    onClick={() => { updateField('pronoun', p); setShowPronounMenu(false); }}
                                  >
                                    {p}
                                  </button>
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>
                      {/* Name */}
                      <input
                        value={profile.name}
                        onChange={e => updateField('name', e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                        placeholder="Patient name"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                      <Phone size={14} className="text-slate-400" />
                      Patient Phone Number
                    </label>
                    <div className="flex gap-3">
                      {/* Country code */}
                      <div ref={countryRef} className="relative">
                        <button
                          onClick={() => setShowCountryMenu(v => !v)}
                          className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                        >
                          <span>{countryCode.flag}</span>
                          <ChevronDown size={13} className="text-slate-400" />
                        </button>
                        <AnimatePresence>
                          {showCountryMenu && (
                            <motion.ul
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="absolute top-full mt-1 left-0 z-50 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-[140px]"
                            >
                              {COUNTRY_CODES.map(c => (
                                <li key={c.code}>
                                  <button
                                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                    onClick={() => { setCountryCode(c); setShowCountryMenu(false); }}
                                  >
                                    <span>{c.flag}</span>
                                    <span className="text-slate-400">{c.code}</span>
                                    <span>{c.label}</span>
                                  </button>
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>
                      <input
                        value={profile.phone}
                        onChange={e => updateField('phone', e.target.value)}
                        type="tel"
                        placeholder="Phone number"
                        className="flex-1 px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                      <Mail size={14} className="text-slate-400" />
                      Patient Email
                    </label>
                    <input
                      value={profile.email}
                      onChange={e => updateField('email', e.target.value)}
                      type="email"
                      placeholder="patient@email.com"
                      className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                    />
                  </div>

                  {/* DOB */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
                      <Calendar size={14} className="text-slate-400" />
                      Date of Birth
                    </label>
                    <p className="text-xs text-slate-500 mb-3">You can select from the calendar or type the date in the format YYYY-MM-DD</p>
                    <div className="relative w-48">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        value={profile.dob}
                        onChange={e => updateField('dob', e.target.value)}
                        type="date"
                        placeholder="YYYY-MM-DD"
                        className="w-full pl-9 pr-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                {/* Last Note Summary */}
                {lastNote ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6"
                  >
                    <h3 className="text-base font-bold text-white mb-4">Last Note Summary</h3>
                    <ul className="space-y-3 mb-6">
                      {summaryLines.map((line, i) => (
                        <li key={i} className="text-sm text-slate-300 leading-relaxed">
                          {line}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                      <span className="text-xs text-slate-500">
                        {format(new Date(lastNote.createdAt), 'MMM d, yyyy, h:mm a')}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">Is this helpful?</span>
                        <button
                          onClick={() => { setFeedbackGiven('up'); toast.success('Thanks for your feedback!'); }}
                          className={`p-1.5 rounded-lg transition-colors ${feedbackGiven === 'up' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        >
                          <ThumbsUp size={15} />
                        </button>
                        <button
                          onClick={() => { setFeedbackGiven('down'); toast.success('Thanks for your feedback!'); }}
                          className={`p-1.5 rounded-lg transition-colors ${feedbackGiven === 'down' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        >
                          <ThumbsDown size={15} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 text-center">
                    <AlertCircle size={32} className="mx-auto mb-3 text-slate-500" />
                    <p className="text-slate-400 text-sm">No notes found for this patient yet.</p>
                    <button
                      onClick={() => navigate('/capture')}
                      className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Start New Conversation
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                {patientNotes.length === 0 ? (
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-10 text-center">
                    <FileText size={36} className="mx-auto mb-4 text-slate-500" />
                    <p className="text-slate-400">No notes yet for this patient.</p>
                  </div>
                ) : patientNotes.map(note => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.06] transition-colors cursor-pointer"
                    onClick={() => navigate(`/notes/${note.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-white capitalize">{note.template} Note</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        note.status === 'signed' ? 'bg-emerald-500/15 text-emerald-400' :
                        note.status === 'completed' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-amber-500/15 text-amber-400'
                      }`}>{note.status}</span>
                    </div>
                    <p className="text-xs text-slate-400">{format(new Date(note.dateOfService), 'MMMM d, yyyy')}</p>
                    {note.content.subjective && (
                      <p className="mt-2 text-sm text-slate-400 line-clamp-2">{note.content.subjective}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {(activeTab === 'context' || activeTab === 'treatment' || activeTab === 'reports') && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-10 text-center">
                <ClipboardList size={36} className="mx-auto mb-4 text-slate-500" />
                <p className="text-white font-medium mb-2">
                  {activeTab === 'context' ? 'Patient Context' : activeTab === 'treatment' ? 'Treatment Plan' : 'Reports'} coming soon
                </p>
                <p className="text-slate-400 text-sm">This section will be available in an upcoming update.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Sidebar>
  );
}
