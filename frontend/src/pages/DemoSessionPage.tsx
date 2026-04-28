import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, ArrowLeft, Play, Loader2, Clock } from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useRecordingStore, useNotesStore } from '../store';
import { audioApi, notesApi } from '../services/api';
import toast from 'react-hot-toast';
import type { ClinicalNote } from '../types';

const DEMO_PATIENT = 'Sarah Brown';
const DEMO_TEMPLATE = 'soap' as const;
const MIN_RECORDING_SECONDS = 30;

const DEMO_SCRIPT: { role: 'You' | 'Patient'; text: string }[] = [
  { role: 'You',     text: 'Hi Ms. Brown. What brings you in today?' },
  { role: 'Patient', text: "I've had a sore throat, fever, and a bad cough." },
  { role: 'You',     text: 'How long have these symptoms been going on?' },
  { role: 'Patient', text: 'It started three days ago.' },
  { role: 'You',     text: 'Have you been in contact with anyone who is sick?' },
  { role: 'Patient', text: "Not that I know of. I've been working from home." },
  { role: 'You',     text: 'Any other symptoms, like chills or body aches?' },
  { role: 'Patient', text: "Yes, I've had chills and my muscles ache." },
  { role: 'You',     text: "What's the highest temperature you've had?" },
  { role: 'Patient', text: 'It was 102 degrees.' },
  { role: 'You',     text: 'Have you had any trouble breathing or wheezing?' },
  { role: 'Patient', text: 'No, my breathing has been fine.' },
  { role: 'You',     text: 'Are you taking any medication for the symptoms?' },
  { role: 'Patient', text: 'Just some ibuprofen a few times a day.' },
  {
    role: 'You',
    text: "I'm going to examine you now. Please open your mouth. Your throat is red, but your lungs sound clear. I'll order tests for flu, COVID, RSV, and strep. Until we get the results, keep taking ibuprofen for fever, rest, and stay hydrated. I'll follow up with you once we have the test results.",
  },
  { role: 'Patient', text: 'Thank you, I appreciate it.' },
];

export default function DemoSessionPage() {
  const navigate = useNavigate();
  const { session, startRecording, stopRecording, resetRecording, setDuration } =
    useRecordingStore();
  const { addNote } = useNotesStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isRecordingActive = session.status === 'recording';
  const meetsMinDuration = session.duration >= MIN_RECORDING_SECONDS;
  const remainingSeconds = Math.max(0, MIN_RECORDING_SECONDS - session.duration);
  const minProgress = Math.min(100, (session.duration / MIN_RECORDING_SECONDS) * 100);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (session.status === 'recording') {
      intervalRef.current = setInterval(() => setDuration(session.duration + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [session.status, session.duration, setDuration]);

  // Reset recording on unmount
  useEffect(() => () => { resetRecording(); }, []);

  const handleStartDemo = async () => {
    try {
      await startRecording();
      toast.success('Demo recording started — read the script below!', { icon: '🎙️' });
    } catch {
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const handleEndDemo = async () => {
    if (!meetsMinDuration) {
      toast.error(`Record at least ${remainingSeconds}s more to process the note.`, { icon: '⏱️' });
      return;
    }
    setIsProcessing(true);
    try {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        toast.loading('Uploading demo audio…', { id: 'demo' });
        const file = new File([audioBlob], `demo-${Date.now()}.webm`, { type: 'audio/webm' });
        const uploaded = await audioApi.upload(file);

        toast.loading('Transcribing…', { id: 'demo' });
        const transcribed = await audioApi.transcribe(uploaded.id);

        toast.loading('Generating clinical note…', { id: 'demo' });
        const generated = await audioApi.generateNote(
          transcribed.transcription,
          DEMO_TEMPLATE,
          DEMO_PATIENT,
        );

        toast.dismiss('demo');

        // Sanitize GPT content — strip null / non-string values before sending
        const sanitizedContent: Record<string, unknown> = {};
        if (generated.content && typeof generated.content === 'object') {
          for (const [key, value] of Object.entries(generated.content)) {
            if (value != null && typeof value === 'string') {
              sanitizedContent[key] = value;
            } else if (value != null && typeof value === 'object') {
              sanitizedContent[key] = value;
            }
          }
        }

        const createdNote = await notesApi.create({
          patientName: DEMO_PATIENT,
          dateOfService: new Date().toISOString().split('T')[0],
          template: DEMO_TEMPLATE,
          content: sanitizedContent as any,
          transcription: transcribed.transcription,
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
          createdAt: new Date(createdNote.createdAt),
          updatedAt: new Date(createdNote.updatedAt),
        };

        addNote(newNote);
        toast.success('Demo note generated successfully!');
        navigate(`/notes/${newNote.id}`);
      }
    } catch (error: any) {
      toast.dismiss('demo');
      const msg = error?.details
        ? `Validation failed: ${error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')}`
        : error.message || 'Failed to process demo recording';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      resetRecording();
    }
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen">
        {/* BG glows */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-3xl mx-auto">

          {/* Back */}
          <button
            onClick={() => navigate('/capture')}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors text-sm font-medium group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Return to Main Screen
          </button>

          {/* Page heading */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-semibold mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Demo Session
            </div>
            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Try a Demo Recording</h1>
            <p className="text-slate-400 text-sm">
              {isRecordingActive
                ? 'Recording in progress — read the script below aloud as the doctor.'
                : 'Click the button below, then read the conversation script aloud.'}
            </p>
          </motion.div>

          {/* Start / End button + timer */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="flex flex-col items-center gap-4 mb-10"
          >
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3">
                  <Loader2 size={36} className="text-violet-400 animate-spin" />
                  <p className="text-slate-400 text-sm">Processing your demo recording…</p>
                </motion.div>
              ) : isRecordingActive ? (
                <motion.div key="recording" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-3">

                  {/* Timer */}
                  <div className="flex items-center gap-2">
                    <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                      className="w-2.5 h-2.5 bg-red-400 rounded-full" />
                    <span className="text-2xl font-mono font-bold text-white tabular-nums">
                      {formatTime(session.duration)}
                    </span>
                  </div>

                  {/* Min duration progress */}
                  {!meetsMinDuration && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-amber-400" />
                        <span className="text-amber-400 text-xs font-semibold">{remainingSeconds}s remaining</span>
                      </div>
                      <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
                          animate={{ width: `${minProgress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                    </div>
                  )}

                  {meetsMinDuration && (
                    <span className="text-emerald-400 text-xs font-semibold">✓ Minimum reached — stop when ready</span>
                  )}

                  <motion.button
                    whileHover={{ scale: meetsMinDuration ? 1.04 : 1.01 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleEndDemo}
                    className={`flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg ${
                      meetsMinDuration
                        ? 'bg-red-500 text-white shadow-red-500/30 hover:opacity-90'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Square size={16} />
                    End Demo
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}>
                  <motion.button
                    whileHover={{ scale: 1.04, boxShadow: '0 0 28px rgba(139,92,246,0.45)' }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleStartDemo}
                    className="flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-base rounded-2xl shadow-xl shadow-violet-500/30 hover:opacity-90 transition-all"
                  >
                    <Mic size={20} />
                    Start Demo Recording
                  </motion.button>
                  <p className="text-center text-slate-500 text-xs mt-3">
                    Click the button and read the script below
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Conversation script */}
          <div className="space-y-3 mb-12">
            {DEMO_SCRIPT.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: line.role === 'You' ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.03 }}
                className={`rounded-xl p-4 border-l-4 ${
                  line.role === 'You'
                    ? 'bg-violet-500/[0.07] border-violet-400'
                    : 'bg-emerald-500/[0.07] border-emerald-400'
                }`}
              >
                <p className={`text-xs font-bold mb-1 uppercase tracking-wider ${
                  line.role === 'You' ? 'text-violet-400' : 'text-emerald-400'
                }`}>
                  {line.role === 'You' ? 'You (Doctor)' : 'Patient'}
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">{line.text}</p>
              </motion.div>
            ))}
          </div>

          {/* End instruction */}
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm">
              {isRecordingActive
                ? 'Click "End Demo" when you finish reading the script'
                : 'Click "End" and see your note in the notes menu'}
            </p>
          </div>

          {/* Return to Main Screen */}
          <div className="flex justify-start">
            <button
              onClick={() => navigate('/capture')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Return to Main Screen
            </button>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
