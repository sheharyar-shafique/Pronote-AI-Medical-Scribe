import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Select } from '../components/ui';
import { useRecordingStore, useNotesStore, useSettingsStore } from '../store';
import { templates as allBuiltInTemplates } from '../data';
import { audioApi, notesApi, templatesApi } from '../services/api';
import toast from 'react-hot-toast';
import type { ClinicalNote, Template } from '../types';

const MIN_RECORDING_SECONDS = 30;

export default function CapturePage() {
  const navigate = useNavigate();
  const { 
    session, 
    startRecording, 
    stopRecording, 
    pauseRecording, 
    resumeRecording,
    resetRecording,
    setDuration 
  } = useRecordingStore();
  const { addNote, notes, fetchNotes } = useNotesStore();
  const { selectedTemplate, setTemplate } = useSettingsStore();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientPronoun, setPatientPronoun] = useState('');
  const [shakingStop, setShakingStop] = useState(false);

  // New Patient modal state
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPronoun, setNewPatientPronoun] = useState('-');
  const [showPronounDropdown, setShowPronounDropdown] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const patientFieldRef = useRef<HTMLDivElement>(null);
  const pronounDropdownRef = useRef<HTMLDivElement>(null);

  // Patient search / autocomplete state
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Fetch existing notes on mount to extract known patient names
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Unique patient names from the user's existing notes (most-recent first)
  const existingPatientNames = (() => {
    const seen = new Set<string>();
    const result: string[] = [];
    // notes are typically sorted by createdAt desc from the API
    for (const n of notes) {
      const name = n.patientName?.trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push(name);
      }
    }
    return result;
  })();

  // Filter by search query
  const filteredPatientNames = patientSearchQuery
    ? existingPatientNames.filter(n => n.toLowerCase().includes(patientSearchQuery.toLowerCase()))
    : existingPatientNames;

  const isRecordingActive = session.status === 'recording' || session.status === 'paused';
  const meetsMinDuration = session.duration >= MIN_RECORDING_SECONDS;
  const remainingSeconds = Math.max(0, MIN_RECORDING_SECONDS - session.duration);
  const minProgress = Math.min(100, (session.duration / MIN_RECORDING_SECONDS) * 100);

  // ── My Templates: start from localStorage, then sync from server ─────────────
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
        // New user: default to all built-in templates (localStorage cleared on login)
        setMyTemplates([...allBuiltInTemplates]);
        const defaultIds = allBuiltInTemplates.map(t => t.id);
        templatesApi.savePreferences(defaultIds, []).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Fall back to first My Template if the selected one isn't in My Templates
  const resolvedTemplate =
    myTemplates.find(t => t.id === selectedTemplate) ?? myTemplates[0];

  useEffect(() => {
    if (session.status === 'recording') {
      intervalRef.current = setInterval(() => {
        setDuration(session.duration + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [session.status, session.duration, setDuration]);

  // Close patient dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientFieldRef.current && !patientFieldRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
      if (pronounDropdownRef.current && !pronounDropdownRef.current.contains(e.target as Node)) {
        setShowPronounDropdown(false);
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

  const handleStartRecording = async () => {
    // Patient name is mandatory
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
    // Enforce minimum 30-second recording
    if (!meetsMinDuration) {
      setShakingStop(true);
      setTimeout(() => setShakingStop(false), 600);
      toast.error(`Please record for at least 30 seconds. ${remainingSeconds}s remaining.`, {
        icon: '⏱️',
        duration: 3000,
      });
      return;
    }
    setIsProcessing(true);
    try {
      const audioBlob = await stopRecording();
      
      if (audioBlob) {
        // Step 1: Upload the audio file
        toast.loading('Uploading audio...', { id: 'processing' });
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        const uploadResult = await audioApi.upload(audioFile);
        
        // Step 2: Transcribe with OpenAI Whisper
        toast.loading('Transcribing with AI...', { id: 'processing' });
        const transcriptionResult = await audioApi.transcribe(uploadResult.id);
        
        // Step 3: Generate clinical note with GPT-4
        toast.loading('Generating clinical note...', { id: 'processing' });
        const noteResult = await audioApi.generateNote(
          transcriptionResult.transcription,
          selectedTemplate,
          patientName || undefined,
          resolvedTemplate?.sectionSettings
        );

        toast.dismiss('processing');

        // Warn if server returned mock/placeholder content instead of real AI
        if (noteResult.source === 'mock') {
          toast('⚠️ Note generated with placeholder data — AI key not configured on server.', {
            duration: 6000,
            style: { background: '#92400e', color: '#fef3c7' },
          });
        }
        
        // Step 4: Create the note in the database
        const createdNote = await notesApi.create({
          patientName: patientName || 'Unknown Patient',
          dateOfService: new Date().toISOString().split('T')[0],
          template: selectedTemplate,
          content: noteResult.content,
          transcription: transcriptionResult.transcription,
          audioUrl: uploadResult.url,
        });
        
        // Also add to local store for immediate UI update
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
          createdAt: new Date(createdNote.createdAt),
          updatedAt: new Date(createdNote.updatedAt),
        };
        
        addNote(newNote);
        toast.success('Note generated successfully!');
        navigate(`/notes/${newNote.id}`);
      }
    } catch (error: any) {
      console.error('Recording processing error:', error);
      toast.dismiss('processing');
      toast.error(error.message || 'Failed to process recording');
    } finally {
      setIsProcessing(false);
      resetRecording();
    }
  };

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

  return (
    <Sidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">Capture Conversation</h1>
          <p className="text-slate-400">Record your patient visit and we'll auto-generate clinical notes.</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recording Panel */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 shadow-2xl">
                {/* Patient Info */}
                <div className="mb-6" ref={patientFieldRef}>
                  <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <User size={13} className="text-slate-400" />
                    Patient Name
                    <span className="text-red-400 text-xs ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    {/* Name display / input */}
                    <button
                      type="button"
                      onClick={() => session.status === 'idle' && setShowPatientDropdown(v => !v)}
                      disabled={session.status !== 'idle'}
                      className={`w-full px-4 py-3 rounded-xl border transition-all text-sm text-left flex items-center justify-between ${
                        !patientName
                          ? 'border-white/[0.12] bg-white/5 text-slate-500'
                          : 'border-emerald-500/40 bg-emerald-500/5 text-white'
                      } disabled:opacity-60`}
                    >
                      <span className={patientName ? 'text-white font-medium' : 'text-slate-500'}>
                        {patientName || 'Click to add patient…'}
                      </span>
                      <div className="flex items-center gap-2">
                        {patientPronoun && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            {patientPronoun}
                          </span>
                        )}
                        {patientName && session.status === 'idle' && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); setPatientName(''); setPatientPronoun(''); }}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </span>
                        )}
                        {!patientName && <ChevronDown size={14} className="text-slate-500" />}
                      </div>
                    </button>

                    {/* Dropdown */}
                    <AnimatePresence>
                      {showPatientDropdown && session.status === 'idle' && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                          className="absolute top-full mt-1 left-0 right-0 bg-slate-800/95 backdrop-blur-sm border border-white/[0.12] rounded-xl shadow-2xl z-40 overflow-hidden"
                        >
                          {/* Search / filter input */}
                          <div className="px-3 pt-3 pb-2">
                            <input
                              type="text"
                              placeholder="Patient Name"
                              value={patientSearchQuery}
                              onChange={(e) => setPatientSearchQuery(e.target.value)}
                              autoFocus
                              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                            />
                          </div>

                          {/* Recent patients list */}
                          {filteredPatientNames.length > 0 && (
                            <div className="px-3 pb-1">
                              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1">Recent Patients</p>
                              <div className="max-h-40 overflow-y-auto">
                                {filteredPatientNames.map(name => (
                                  <button
                                    key={name}
                                    onClick={() => {
                                      setPatientName(name);
                                      setShowPatientDropdown(false);
                                      setPatientSearchQuery('');
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white hover:bg-blue-500/15 rounded-lg transition-colors text-left"
                                  >
                                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-blue-400">{name.charAt(0).toUpperCase()}</span>
                                    </div>
                                    {name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {filteredPatientNames.length === 0 && patientSearchQuery && (
                            <div className="px-4 py-3 text-center">
                              <p className="text-xs text-slate-500">No matching patients</p>
                            </div>
                          )}

                          <div className="border-t border-white/[0.08]">
                            <button
                              onClick={() => {
                                // If user typed a name in search, use it directly
                                if (patientSearchQuery.trim()) {
                                  setPatientName(patientSearchQuery.trim());
                                  setPatientSearchQuery('');
                                  setShowPatientDropdown(false);
                                } else {
                                  setShowPatientDropdown(false);
                                  setShowNewPatientModal(true);
                                }
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3.5 text-sm text-violet-400 hover:bg-violet-500/10 transition-colors font-semibold"
                            >
                              <Plus size={15} />
                              New Patient
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Timer Display */}
                <div className="text-center mb-8">
                  <AnimatePresence mode="wait">
                    {isProcessing ? (
                      <motion.div
                        key="processing"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex flex-col items-center"
                      >
                        <Loader2 size={64} className="text-emerald-500 animate-spin mb-4" />
                        <p className="text-lg text-white">Processing your recording...</p>
                        <p className="text-sm text-slate-400 mt-2">Generating clinical notes with AI</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="timer"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <motion.p key={session.duration} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
                          className={`text-7xl font-mono font-bold mb-4 tabular-nums tracking-tight ${
                            isRecordingActive && !meetsMinDuration ? 'text-amber-400' : 'text-white'
                          }`}>
                          {formatTime(session.duration)}
                        </motion.p>
                        
                        {/* Minimum duration progress bar */}
                        {isRecordingActive && !meetsMinDuration && (
                          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Clock size={14} className="text-amber-400" />
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

                        {meetsMinDuration && isRecordingActive && (
                          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-emerald-400 text-xs font-bold">✓ Minimum reached — stop when ready</span>
                          </motion.div>
                        )}
                        
                        {session.status === 'recording' && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-center gap-2"
                          >
                            <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                              className="w-3 h-3 bg-red-400 rounded-full" />
                            <span className="text-red-400 font-semibold">Recording</span>
                          </motion.div>
                        )}
                        
                        {session.status === 'paused' && (
                          <span className="text-amber-400 font-semibold">Paused</span>
                        )}
                        
                        {session.status === 'idle' && (
                          <span className="text-slate-400">Ready to record</span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  {session.status === 'idle' && !isProcessing && (
                    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                      onClick={handleStartRecording}
                      className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40">
                      <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 rounded-full bg-emerald-500/30" />
                      <Mic size={36} className="relative z-10" />
                    </motion.button>
                  )}

                  {session.status === 'recording' && (
                    <>
                      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                        onClick={pauseRecording}
                        className="w-16 h-16 bg-amber-500/20 border-2 border-amber-400 rounded-full flex items-center justify-center text-amber-400 shadow-lg">
                        <Pause size={22} />
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
                          className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all ${
                            meetsMinDuration
                              ? 'bg-red-500 shadow-red-500/40 cursor-pointer'
                              : 'bg-slate-600 shadow-slate-600/20 cursor-not-allowed opacity-60'
                          }`}>
                          <Square size={30} />
                        </motion.button>
                        {!meetsMinDuration && (
                          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-amber-400 font-semibold">
                            {remainingSeconds}s left
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}

                  {session.status === 'paused' && (
                    <>
                      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                        onClick={resumeRecording}
                        className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center text-emerald-400 shadow-lg">
                        <Play size={22} />
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
                          className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all ${
                            meetsMinDuration
                              ? 'bg-red-500 shadow-red-500/40 cursor-pointer'
                              : 'bg-slate-600 shadow-slate-600/20 cursor-not-allowed opacity-60'
                          }`}>
                          <Square size={30} />
                        </motion.button>
                        {!meetsMinDuration && (
                          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-amber-400 font-semibold">
                            {remainingSeconds}s left
                          </div>
                        )}
                      </motion.div>
                      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                        onClick={handleReset}
                        className="w-16 h-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-slate-400 shadow-lg">
                        <RotateCcw size={20} />
                      </motion.button>
                    </>
                  )}
                </div>

                {/* Tips */}
                <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="font-medium text-emerald-400 mb-2">💡 Tips for best results</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• <span className="text-amber-400 font-semibold">Minimum 30 seconds</span> required per recording</li>
                    <li>• Speak clearly and at a natural pace</li>
                    <li>• Minimize background noise</li>
                    <li>• State important details explicitly</li>
                  </ul>
                </div>

                {/* Demo session link */}
                {session.status === 'idle' && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => navigate('/demo')}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-500/[0.07] border border-violet-500/20 text-violet-400 hover:bg-violet-500/15 hover:border-violet-500/40 transition-all text-sm font-medium group"
                  >
                    <Play size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    New to Pronote? Try a demo session
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Settings Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
             <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                  <FileText size={16} className="text-white" />
                </div>
                Note Settings
              </h3>

              <div className="space-y-4">
                <Select
                  label="Template"
                  value={selectedTemplate}
                  onChange={(e) => setTemplate(e.target.value as any)}
                  options={myTemplates.map((t) => ({ value: t.id, label: t.name }))}
                />

                <div className="pt-4 border-t border-white/[0.08]">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">Template Sections</h4>
                  <ul className="text-sm text-slate-400 space-y-1.5">
                    {resolvedTemplate?.sections.map((section, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        {section}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recent Recordings Info */}
             <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 mt-4">
              <h4 className="font-bold text-white mb-3">Session Info</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status</span>
                  <span className={`font-bold capitalize px-2.5 py-0.5 rounded-full text-xs ${session.status === 'recording' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : session.status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-slate-400 border border-white/10'}`}>{session.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration</span>
                  <span className="font-bold text-white font-mono">{formatTime(session.duration)}</span>
                </div>
              </div>
            </div>
          </motion.div>
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
                    className="w-full px-3 py-3 bg-white/[0.05] border border-white/[0.12] rounded-xl text-sm text-white flex items-center justify-between gap-2 hover:border-violet-500/40 transition-all"
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
                                ? 'bg-violet-500/20 text-violet-300 font-semibold'
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
                  className="flex-1 px-4 py-3 bg-white/[0.05] border border-white/[0.12] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm"
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
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-500/25 hover:opacity-90 transition-all"
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
