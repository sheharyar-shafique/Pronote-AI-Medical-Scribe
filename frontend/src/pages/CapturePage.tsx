import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, 
  Pause, 
  Play, 
  Square, 
  RotateCcw,
  Loader2,
  Clock,
  FileText,
  Plus,
  X,
  ChevronDown,
  User,
  Search,
  Headphones,
  Upload,
  MessageSquare,
  Type,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useRecordingStore, useNotesStore, useSettingsStore } from '../store';
import { templates as allBuiltInTemplates } from '../data';
import { buildDefaultSectionSettings } from '../data/sectionDefaults';
import { audioApi, notesApi, templatesApi } from '../services/api';
import { sanitizeNoteContent } from '../utils/noteContent';
import toast from 'react-hot-toast';
import type { ClinicalNote, Template } from '../types';

const MIN_RECORDING_SECONDS = 20;
const MAX_RECORDING_SECONDS = 2 * 60 * 60;
const MAX_WARNING_LEAD_SECONDS = 5 * 60;

// ── Helper: group notes by date ──────────────────────────────────────────────
function groupNotesByDate(notes: ClinicalNote[]) {
  const groups: { label: string; notes: ClinicalNote[] }[] = [];
  const map = new Map<string, ClinicalNote[]>();

  for (const note of notes) {
    const d = new Date(note.createdAt);
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (!map.has(label)) {
      map.set(label, []);
    }
    map.get(label)!.push(note);
  }

  for (const [label, items] of map) {
    groups.push({ label, notes: items });
  }
  return groups;
}

// Helper: extract a short title from note content
function getNoteTitle(note: ClinicalNote): string {
  const topic =
    note.content?.topic ||
    note.content?.customSections?.topic ||
    '';
  if (topic) return topic;

  // Fallback: use template name
  const tpl = allBuiltInTemplates.find((t) => t.id === note.template);
  return tpl?.name || note.template || 'Clinical Note';
}

export default function CapturePage() {
  const navigate = useNavigate();
  const {
    session,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    setDuration,
  } = useRecordingStore();
  const { addNote, notes, fetchNotes } = useNotesStore();
  const { selectedTemplate, setTemplate } = useSettingsStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'idle' | 'note'>('idle');
  const [patientName, setPatientName] = useState('');
  const [patientPronoun, setPatientPronoun] = useState('');
  const [shakingStop, setShakingStop] = useState(false);
  const [sessionType, setSessionType] = useState<'in-person' | 'virtual'>('in-person');
  const [usingHeadphones, setUsingHeadphones] = useState(false);
  const [showCaptureDropdown, setShowCaptureDropdown] = useState(false);
  const captureDropdownRef = useRef<HTMLDivElement>(null);

  // Notes list panel state
  const [notesTab, setNotesTab] = useState<'all' | 'unread'>('all');
  const [notesSearch, setNotesSearch] = useState('');

  // New Patient modal state
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPronoun, setNewPatientPronoun] = useState('-');
  const [showPronounDropdown, setShowPronounDropdown] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const patientFieldRef = useRef<HTMLDivElement>(null);
  const pronounDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch existing notes on mount
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Notes filtered for the left panel
  const filteredNotes = useMemo(() => {
    let result = [...notes];
    if (notesSearch.trim()) {
      const q = notesSearch.toLowerCase();
      result = result.filter(
        (n) =>
          n.patientName?.toLowerCase().includes(q) ||
          getNoteTitle(n).toLowerCase().includes(q)
      );
    }
    if (notesTab === 'unread') {
      result = result.filter((n) => n.status === 'draft');
    }
    return result;
  }, [notes, notesSearch, notesTab]);

  const groupedNotes = useMemo(() => groupNotesByDate(filteredNotes), [filteredNotes]);

  const isRecordingActive = session.status === 'recording' || session.status === 'paused';
  const meetsMinDuration = session.duration >= MIN_RECORDING_SECONDS;
  const remainingSeconds = Math.max(0, MIN_RECORDING_SECONDS - session.duration);
  const minProgress = Math.min(100, (session.duration / MIN_RECORDING_SECONDS) * 100);

  // ── My Templates ─────────────────────────────────────────────────────────────
  const [myTemplates, setMyTemplates] = useState<Template[]>(() => {
    try {
      const raw = localStorage.getItem('pronote_added_ids');
      const addedIds: string[] = raw ? JSON.parse(raw) : allBuiltInTemplates.map(t => t.id);
      const customRaw = localStorage.getItem('pronote_custom_templates');
      const customs: Template[] = customRaw ? JSON.parse(customRaw) : [];
      return [...allBuiltInTemplates, ...customs].filter(t => addedIds.includes(t.id));
    } catch {
      return allBuiltInTemplates;
    }
  });

  useEffect(() => {
    templatesApi.getPreferences().then(res => {
      if (res.preferences) {
        const { addedIds, customTemplates: serverCustom } = res.preferences;
        const customs = serverCustom as unknown as Template[];
        const combined = [...allBuiltInTemplates, ...customs].filter(t => addedIds.includes(t.id));
        setMyTemplates(combined);
        try {
          localStorage.setItem('pronote_added_ids', JSON.stringify(addedIds));
          localStorage.setItem('pronote_custom_templates', JSON.stringify(serverCustom));
        } catch {}
      } else {
        setMyTemplates([...allBuiltInTemplates]);
        const defaultIds = allBuiltInTemplates.map(t => t.id);
        templatesApi.savePreferences(defaultIds, []).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const resolvedTemplate =
    myTemplates.find(t => t.id === selectedTemplate) ?? myTemplates[0];

  // ── Timer logic ──────────────────────────────────────────────────────────────
  const warnedNearMaxRef = useRef(false);
  const stopHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (session.status === 'recording') {
      const tick = () => {
        const { recordingStartedAt, pausedAt, pausedTotalMs } =
          useRecordingStore.getState() as any;
        if (!recordingStartedAt) return;
        const pausedMs =
          (pausedTotalMs || 0) + (pausedAt != null ? Date.now() - pausedAt : 0);
        const next = Math.max(
          0,
          Math.floor((Date.now() - recordingStartedAt - pausedMs) / 1000)
        );

        if (
          next >= MAX_RECORDING_SECONDS - MAX_WARNING_LEAD_SECONDS &&
          next < MAX_RECORDING_SECONDS &&
          !warnedNearMaxRef.current
        ) {
          warnedNearMaxRef.current = true;
          toast(
            'Recording will auto-stop in 5 minutes (2-hour maximum). Wrap up when you can.',
            { icon: '⏰', duration: 6000 }
          );
        }

        if (next >= MAX_RECORDING_SECONDS) {
          toast.success('2-hour limit reached — processing the recording now.', {
            icon: '⏰',
            duration: 4000,
          });
          stopHandlerRef.current();
          return;
        }

        setDuration(next);
      };

      tick();
      intervalRef.current = setInterval(tick, 500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (session.status === 'idle' || session.status === 'completed') {
        warnedNearMaxRef.current = false;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, setDuration]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientFieldRef.current && !patientFieldRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
      if (pronounDropdownRef.current && !pronounDropdownRef.current.contains(e.target as Node)) {
        setShowPronounDropdown(false);
      }
      if (captureDropdownRef.current && !captureDropdownRef.current.contains(e.target as Node)) {
        setShowCaptureDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleStartRecording = async () => {
    if (!patientName.trim()) {
      toast.error('Patient name is required to start recording.', { icon: '\uD83D\uDC64', duration: 3000 });
      return;
    }
    try {
      await startRecording();
      toast.success('Recording started - speak clearly');
    } catch (error) {
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const handleStopRecording = async () => {
    if (!meetsMinDuration) {
      setShakingStop(true);
      setTimeout(() => setShakingStop(false), 600);
      toast.error(`Please record for at least ${MIN_RECORDING_SECONDS} seconds. ${remainingSeconds}s remaining.`, {
        icon: '⏱️',
        duration: 3000,
      });
      return;
    }
    setIsProcessing(true);
    try {
      const transcription = (await stopRecording()).trim();

      if (!transcription) {
        throw new Error(
          'Transcription returned no text — the recording may have been silent or transcription failed to start.'
        );
      }

      let savedContext = '';
      let savedTreatmentPlan = '';
      if (patientName) {
        try {
          const slug = patientName.toLowerCase().replace(/\s+/g, '_');
          savedContext = localStorage.getItem(`pronote_patient_context_${slug}`) ?? '';
          savedTreatmentPlan = localStorage.getItem(`pronote_patient_treatment_plan_${slug}`) ?? '';
        } catch {}
      }

      setProcessingStage('note');
      const effectiveSectionSettings =
        resolvedTemplate?.sectionSettings ??
        buildDefaultSectionSettings(resolvedTemplate?.sections);
      const noteResult = await audioApi.generateNote(
        transcription,
        selectedTemplate,
        patientName || undefined,
        effectiveSectionSettings,
        savedContext.trim() || undefined,
        savedTreatmentPlan.trim() || undefined,
        resolvedTemplate?.sections
      );

      const transcriptionResult = { transcription };
      {
        if (noteResult.source === 'mock') {
          toast('⚠️ Note generated with placeholder data — AI key not configured on server.', {
            duration: 6000,
            style: { background: '#92400e', color: '#fef3c7' },
          });
        }

        const sanitizedContent = sanitizeNoteContent(noteResult.content);
        const recordingDuration = session.duration;
        const createdNote = await notesApi.create({
          patientName: patientName || 'Unknown Patient',
          dateOfService: new Date().toISOString().split('T')[0],
          template: selectedTemplate,
          content: sanitizedContent as any,
          transcription: transcriptionResult.transcription,
          processingTime: recordingDuration,
        });

        const newNote: ClinicalNote = {
          id: createdNote.id,
          userId: createdNote.userId,
          patientName: createdNote.patientName,
          dateOfService: new Date(createdNote.dateOfService),
          template: createdNote.template,
          content: createdNote.content,
          status: createdNote.status,
          transcription: createdNote.transcription,
          audioUrl: createdNote.audioUrl,
          durationSeconds: createdNote.durationSeconds ?? recordingDuration,
          createdAt: new Date(createdNote.createdAt),
          updatedAt: new Date(createdNote.updatedAt),
        };
        
        addNote(newNote);
        toast.success('Note generated successfully!');
        navigate(`/notes/${newNote.id}`);
      }
    } catch (error: any) {
      console.error('Recording processing error:', error);
      const msg = error?.details
        ? `Validation failed: ${error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')}`
        : error.message || 'Failed to process recording';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      setProcessingStage('idle');
      resetRecording();
    }
  };

  stopHandlerRef.current = handleStopRecording;

  const handleReset = () => {
    resetRecording();
    toast.success('Recording reset');
  };

  const PRONOUNS = ['She/Her', 'He/Him', 'They/Them'];

  const handleCreatePatient = () => {
    if (!newPatientName.trim()) {
      toast.error('Please enter the patient name');
      return;
    }
    setPatientName(newPatientName.trim());
    setPatientPronoun(newPatientPronoun === '-' ? '' : newPatientPronoun);
    setShowNewPatientModal(false);
    setNewPatientName('');
    setNewPatientPronoun('-');
    setShowPronounDropdown(false);
    toast.success('Patient added!');
  };

  // Unique patient names from notes (for autocomplete dropdown)
  const existingPatientNames = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const n of notes) {
      const name = n.patientName?.trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push(name);
      }
    }
    return result;
  }, [notes]);

  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const filteredPatientNames = patientSearchQuery
    ? existingPatientNames.filter(n => n.toLowerCase().includes(patientSearchQuery.toLowerCase()))
    : existingPatientNames;

  return (
    <Sidebar>
      <div className="flex h-[calc(100vh-0px)]" style={{ minHeight: 0 }}>
        {/* ═══════════ LEFT PANEL: Notes List ═══════════ */}
        <div
          className="hidden lg:flex flex-col border-r border-slate-700/60 bg-white/[0.02]"
          style={{ width: 300, minWidth: 300, maxWidth: 300 }}
        >
          {/* All / Unread tabs */}
          <div className="flex border-b border-slate-700/60">
            <button
              onClick={() => setNotesTab('all')}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                notesTab === 'all'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setNotesTab('unread')}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                notesTab === 'unread'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unread
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by title or patient"
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-slate-700/60 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
              />
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto">
            {groupedNotes.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No notes found</p>
              </div>
            )}
            {groupedNotes.map((group) => (
              <div key={group.label}>
                {/* Date header */}
                <div className="px-4 py-2 bg-white/[0.02]">
                  <span className="text-xs font-semibold text-slate-500">{group.label}</span>
                </div>
                {/* Note items */}
                {group.notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => navigate(`/notes/${note.id}`)}
                    className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-indigo-500/[0.06] transition-colors group"
                  >
                    <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                      {note.patientName || 'Unknown Patient'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate leading-relaxed">
                      {getNoteTitle(note)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {new Date(note.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {', '}
                      {new Date(note.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════ RIGHT PANEL: Capture Form ═══════════ */}
        <div className="flex-1 flex items-start justify-center overflow-y-auto">
          <div className="w-full max-w-lg px-6 py-12">
            <AnimatePresence mode="wait">
              {/* ── IDLE STATE: Capture form ──────────────────────────── */}
              {session.status === 'idle' && !isProcessing && (
                <motion.div
                  key="capture-form"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  {/* Patient Name */}
                  <div ref={patientFieldRef}>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Patient Name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        onFocus={() => setShowPatientDropdown(true)}
                        className="w-full px-4 py-3 bg-transparent border-b border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors text-sm"
                      />
                      {patientName && (
                        <button
                          onClick={() => { setPatientName(''); setPatientPronoun(''); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}

                      {/* Patient autocomplete dropdown */}
                      <AnimatePresence>
                        {showPatientDropdown && existingPatientNames.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.12 }}
                            className="absolute top-full mt-1 left-0 right-0 bg-slate-800/95 backdrop-blur-sm border border-white/[0.12] rounded-xl shadow-2xl z-40 overflow-hidden max-h-48 overflow-y-auto"
                          >
                            {existingPatientNames
                              .filter(n => !patientName || n.toLowerCase().includes(patientName.toLowerCase()))
                              .slice(0, 8)
                              .map(name => (
                              <button
                                key={name}
                                onClick={() => {
                                  setPatientName(name);
                                  setShowPatientDropdown(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-indigo-500/15 transition-colors text-left"
                              >
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-bold text-indigo-400">{name.charAt(0).toUpperCase()}</span>
                                </div>
                                {name}
                              </button>
                            ))}
                            <div className="border-t border-white/[0.08]">
                              <button
                                onClick={() => {
                                  setShowPatientDropdown(false);
                                  setShowNewPatientModal(true);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors font-semibold"
                              >
                                <Plus size={14} />
                                New Patient
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Template */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-slate-400 font-medium whitespace-nowrap" style={{ minWidth: 100 }}>
                      Template
                    </label>
                    <div className="flex-1 relative">
                      <select
                        value={selectedTemplate}
                        onChange={(e) => setTemplate(e.target.value as any)}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-slate-700/60 rounded-lg text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                      >
                        {myTemplates.map((t) => (
                          <option key={t.id} value={t.id} className="bg-slate-800 text-white">
                            {t.name.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Session Type */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-slate-400 font-medium whitespace-nowrap" style={{ minWidth: 100 }}>
                      Session type
                    </label>
                    <div className="flex-1 relative">
                      <select
                        value={sessionType}
                        onChange={(e) => setSessionType(e.target.value as 'in-person' | 'virtual')}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-slate-700/60 rounded-lg text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                      >
                        <option value="in-person" className="bg-slate-800 text-white">In person</option>
                        <option value="virtual" className="bg-slate-800 text-white">Virtual</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Headphones toggle — only visible when Virtual */}
                  <AnimatePresence>
                    {sessionType === 'virtual' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex rounded-lg border border-slate-700/60 overflow-hidden">
                          <button
                            onClick={() => setUsingHeadphones(false)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                              !usingHeadphones
                                ? 'bg-indigo-500/15 text-indigo-300 border-r border-indigo-500/30'
                                : 'bg-white/[0.02] text-slate-400 border-r border-slate-700/60 hover:bg-white/[0.04]'
                            }`}
                          >
                            <Headphones size={15} />
                            Not using Headphones
                          </button>
                          <button
                            onClick={() => setUsingHeadphones(true)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                              usingHeadphones
                                ? 'bg-indigo-500/15 text-indigo-300'
                                : 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
                            }`}
                          >
                            <Headphones size={15} />
                            Using Headphones
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Capture Conversation Split Button */}
                  <div className="pt-4 relative" ref={captureDropdownRef}>
                    <div className="flex rounded-xl overflow-hidden shadow-lg shadow-indigo-500/25">
                      {/* Main button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleStartRecording}
                        className="flex-1 flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold transition-all text-sm"
                      >
                        <Mic size={18} />
                        Capture Conversation
                      </motion.button>
                      {/* Dropdown arrow */}
                      <button
                        onClick={() => setShowCaptureDropdown(v => !v)}
                        className="px-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white border-l border-indigo-400/30 transition-all"
                      >
                        <ChevronDown size={16} className={`transition-transform ${showCaptureDropdown ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Dropdown menu */}
                    <AnimatePresence>
                      {showCaptureDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                          className="absolute top-full mt-1.5 right-0 w-64 bg-slate-800/95 backdrop-blur-sm border border-white/[0.12] rounded-xl shadow-2xl z-50 overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              setShowCaptureDropdown(false);
                              navigate('/dictation');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-indigo-500/10 transition-colors text-left"
                          >
                            <MessageSquare size={16} className="text-slate-400" />
                            Dictate Session Summary
                          </button>
                          <button
                            onClick={() => {
                              setShowCaptureDropdown(false);
                              toast('Text to Note coming soon!', { icon: '📝' });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-indigo-500/10 transition-colors text-left"
                          >
                            <Type size={16} className="text-slate-400" />
                            Text to Note
                          </button>
                          <button
                            onClick={() => {
                              setShowCaptureDropdown(false);
                              navigate('/upload');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-indigo-500/10 transition-colors text-left"
                          >
                            <Upload size={16} className="text-slate-400" />
                            Upload Recording
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Demo link */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => navigate('/demo')}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Play size={12} />
                    New to Pronote? Try a demo session
                  </motion.button>
                </motion.div>
              )}

              {/* ── RECORDING STATE ──────────────────────────────────── */}
              {isRecordingActive && !isProcessing && (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                  className="text-center space-y-6"
                >
                  {/* Patient & Session info */}
                  <div>
                    <p className="text-slate-400 text-sm">Recording session for</p>
                    <p className="text-white font-bold text-lg">{patientName}</p>
                    <p className="text-slate-500 text-xs mt-1 capitalize">
                      {sessionType === 'in-person' ? 'In person' : 'Virtual'} • {resolvedTemplate?.name}
                    </p>
                  </div>

                  {/* Timer */}
                  <div>
                    <motion.p
                      key={session.duration}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      className={`text-6xl font-mono font-bold tabular-nums tracking-tight ${
                        !meetsMinDuration ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {formatTime(session.duration)}
                    </motion.p>

                    {/* Minimum duration bar */}
                    {!meetsMinDuration && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Clock size={13} className="text-amber-400" />
                          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                            Minimum: {remainingSeconds}s remaining
                          </span>
                        </div>
                        <div className="w-48 mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${minProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </motion.div>
                    )}

                    {meetsMinDuration && (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mt-3">
                        <span className="text-emerald-400 text-xs font-bold">✓ Minimum reached — stop when ready</span>
                      </motion.div>
                    )}

                    {/* Status indicator */}
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {session.status === 'recording' && (
                        <>
                          <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                            className="w-2.5 h-2.5 bg-red-400 rounded-full" />
                          <span className="text-red-400 font-semibold text-sm">Recording</span>
                        </>
                      )}
                      {session.status === 'paused' && (
                        <span className="text-amber-400 font-semibold text-sm">Paused</span>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4 pt-2">
                    {session.status === 'recording' && (
                      <>
                        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                          onClick={pauseRecording}
                          className="w-14 h-14 bg-amber-500/20 border-2 border-amber-400 rounded-full flex items-center justify-center text-amber-400 shadow-lg">
                          <Pause size={20} />
                        </motion.button>
                        <motion.div
                          animate={shakingStop ? { x: [-6, 6, -6, 6, 0] } : {}}
                          transition={{ duration: 0.4 }}
                          className="relative"
                        >
                          <motion.button
                            whileHover={{ scale: meetsMinDuration ? 1.06 : 1.02 }}
                            whileTap={{ scale: meetsMinDuration ? 0.94 : 0.98 }}
                            onClick={handleStopRecording}
                            title={!meetsMinDuration ? `Record at least ${remainingSeconds}s more` : 'Stop and process'}
                            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl transition-all ${
                              meetsMinDuration
                                ? 'bg-red-500 shadow-red-500/40 cursor-pointer'
                                : 'bg-slate-600 shadow-slate-600/20 cursor-not-allowed opacity-60'
                            }`}>
                            <Square size={26} />
                          </motion.button>
                        </motion.div>
                      </>
                    )}

                    {session.status === 'paused' && (
                      <>
                        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                          onClick={resumeRecording}
                          className="w-14 h-14 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center text-emerald-400 shadow-lg">
                          <Play size={20} />
                        </motion.button>
                        <motion.div
                          animate={shakingStop ? { x: [-6, 6, -6, 6, 0] } : {}}
                          transition={{ duration: 0.4 }}
                          className="relative"
                        >
                          <motion.button
                            whileHover={{ scale: meetsMinDuration ? 1.06 : 1.02 }}
                            whileTap={{ scale: meetsMinDuration ? 0.94 : 0.98 }}
                            onClick={handleStopRecording}
                            title={!meetsMinDuration ? `Record at least ${remainingSeconds}s more` : 'Stop and process'}
                            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl transition-all ${
                              meetsMinDuration
                                ? 'bg-red-500 shadow-red-500/40 cursor-pointer'
                                : 'bg-slate-600 shadow-slate-600/20 cursor-not-allowed opacity-60'
                            }`}>
                            <Square size={26} />
                          </motion.button>
                        </motion.div>
                        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                          onClick={handleReset}
                          className="w-14 h-14 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-slate-400 shadow-lg">
                          <RotateCcw size={18} />
                        </motion.button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── PROCESSING STATE ─────────────────────────────────── */}
              {isProcessing && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center py-12"
                >
                  <Loader2 size={56} className="text-indigo-500 animate-spin mb-5" />
                  <p className="text-lg text-white font-semibold">Processing your recording...</p>
                  <p className="text-sm text-slate-400 mt-2">
                    {processingStage === 'note'
                      ? 'Generating clinical notes with AI — typically 15-30 seconds'
                      : 'Finalizing transcription…'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── New Patient Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewPatientModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowNewPatientModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900 border border-white/[0.12] rounded-2xl p-7 w-full max-w-lg shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-white mb-1">New Patient</h2>
                  <p className="text-slate-400 text-sm">Please add the patient's name and pronoun</p>
                </div>
                <button
                  onClick={() => setShowNewPatientModal(false)}
                  className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Pronoun + Name row */}
              <div className="flex gap-3 mb-6">
                {/* Pronoun dropdown */}
                <div className="relative flex-shrink-0 w-36" ref={pronounDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowPronounDropdown(v => !v)}
                    className="w-full px-3 py-3 bg-white/[0.05] border border-white/[0.12] rounded-xl text-sm text-white flex items-center justify-between gap-2 hover:border-indigo-500/40 transition-all"
                  >
                    <span className={newPatientPronoun === '-' ? 'text-slate-500' : 'text-white'}>
                      {newPatientPronoun}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showPronounDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showPronounDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-white/[0.12] rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        {['-', ...PRONOUNS].map(p => (
                          <button
                            key={p}
                            onClick={() => { setNewPatientPronoun(p); setShowPronounDropdown(false); }}
                            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                              newPatientPronoun === p
                                ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                                : 'text-slate-300 hover:bg-white/[0.06]'
                            }`}
                          >
                            {p === '-' ? <span className="text-slate-500">-</span> : p}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Name input */}
                <input
                  type="text"
                  value={newPatientName}
                  onChange={e => setNewPatientName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreatePatient()}
                  placeholder="Patient Name"
                  autoFocus
                  className="flex-1 px-4 py-3 bg-white/[0.05] border border-white/[0.12] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreatePatient}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-all"
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sidebar>
  );
}
