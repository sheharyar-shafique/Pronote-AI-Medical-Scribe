import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Type, User, FileText, Clock, Calendar } from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useNotesStore, useSettingsStore } from '../store';
import { templates as allBuiltInTemplates } from '../data';
import { buildDefaultSectionSettings } from '../data/sectionDefaults';
import { audioApi, notesApi, templatesApi } from '../services/api';
import { sanitizeNoteContent } from '../utils/noteContent';
import toast from 'react-hot-toast';
import type { ClinicalNote, Template } from '../types';

const MIN_WORDS = 20;

// Local "now" formatted for <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
function localNowForInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const PLACEHOLDER = `Examples:
Client showed improved symptoms of anxiety
Patient reported reduced severity of chronic back pain.
Physician conducted routine physical examination.
Therapist utilized DBT
Patient showed signs of improvement
Follow up in 2 weeks`;

export default function TextToNotePage() {
  const navigate = useNavigate();
  const { addNote } = useNotesStore();
  const { selectedTemplate, setTemplate } = useSettingsStore();

  const [patientName, setPatientName] = useState('');
  const [sessionType, setSessionType] = useState<'in-person' | 'virtual'>('virtual');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [sessionTime, setSessionTime] = useState(localNowForInput());
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // ── My Templates: same source as the Capture page ───────────────────────────
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
        setMyTemplates([...allBuiltInTemplates, ...customs].filter(t => addedIds.includes(t.id)));
      }
    }).catch(() => {});
  }, []);

  const resolvedTemplate =
    myTemplates.find(t => t.id === selectedTemplate) ?? myTemplates[0];

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canGenerate = wordCount >= MIN_WORDS && !!patientName.trim() && !isGenerating;

  const handleGenerate = async () => {
    if (!patientName.trim()) {
      toast.error('Patient name is required.', { icon: '👤' });
      return;
    }
    if (wordCount < MIN_WORDS) {
      toast.error(`Please write at least ${MIN_WORDS} words (currently ${wordCount}).`);
      return;
    }

    setIsGenerating(true);
    try {
      // Session metadata gives the AI context that shorthand text alone lacks,
      // and lands in the stored transcription for the record.
      const metaParts = [`Session type: ${sessionType === 'virtual' ? 'Virtual (telehealth)' : 'In person'}.`];
      if (durationMinutes && Number(durationMinutes) > 0) {
        metaParts.push(`Session duration: ${Number(durationMinutes)} minutes.`);
      }
      if (sessionTime) {
        metaParts.push(`Session time: ${new Date(sessionTime).toLocaleString()}.`);
      }
      const transcription = `${metaParts.join(' ')}\n\nClinician's session summary (shorthand notes written by the clinician — expand into a complete note):\n\n${text.trim()}`;

      // Saved patient context / treatment plan, same as the capture flow.
      let savedContext = '';
      let savedTreatmentPlan = '';
      try {
        const slug = patientName.trim().toLowerCase().replace(/\s+/g, '_');
        savedContext = localStorage.getItem(`pronote_patient_context_${slug}`) ?? '';
        savedTreatmentPlan = localStorage.getItem(`pronote_patient_treatment_plan_${slug}`) ?? '';
      } catch {}

      const effectiveSectionSettings =
        resolvedTemplate?.sectionSettings ??
        buildDefaultSectionSettings(resolvedTemplate?.sections);

      const noteResult = await audioApi.generateNote(
        transcription,
        selectedTemplate,
        patientName.trim() || undefined,
        effectiveSectionSettings,
        savedContext.trim() || undefined,
        savedTreatmentPlan.trim() || undefined,
        resolvedTemplate?.sections
      );

      if (noteResult.source === 'mock') {
        toast('⚠️ Note generated with placeholder data — AI key not configured on server.', {
          duration: 6000,
          style: { background: '#92400e', color: '#fef3c7' },
        });
      }

      const sanitizedContent = sanitizeNoteContent(noteResult.content);
      const durationSecs = durationMinutes && Number(durationMinutes) > 0
        ? Math.round(Number(durationMinutes) * 60)
        : undefined;

      const createdNote = await notesApi.create({
        patientName: patientName.trim() || 'Unknown Patient',
        dateOfService: (sessionTime || localNowForInput()).slice(0, 10),
        template: selectedTemplate,
        content: sanitizedContent as any,
        transcription,
        processingTime: durationSecs,
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
        durationSeconds: createdNote.durationSeconds ?? durationSecs,
        createdAt: new Date(createdNote.createdAt),
        updatedAt: new Date(createdNote.updatedAt),
      };

      addNote(newNote);
      toast.success('Note generated successfully!');
      navigate(`/notes/${newNote.id}`);
    } catch (error: any) {
      console.error('Text-to-note error:', error);
      const msg = error?.details
        ? `Validation failed: ${error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')}`
        : error?.message || 'Failed to generate note';
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const labelCls = 'w-44 flex-shrink-0 text-sm font-semibold text-slate-300 flex items-center gap-2';
  const fieldCls =
    'flex-1 px-4 py-3 bg-white/[0.05] border border-white/[0.12] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm';

  return (
    <Sidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/capture')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm font-medium group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Capture
        </button>

        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center">
              <Type size={20} className="text-white" />
            </div>
            Text to Note
          </h1>
          <p className="text-slate-400">
            Type a brief session summary and we'll expand it into a complete clinical note.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-5"
        >
          {/* Patient */}
          <div className="flex items-center gap-4">
            <label className={labelCls}>
              <User size={14} className="text-slate-400" /> Patient
              <span className="text-red-400 text-xs">*</span>
            </label>
            <input
              type="text"
              value={patientName}
              onChange={e => setPatientName(e.target.value)}
              placeholder="Patient Name"
              className={fieldCls}
            />
          </div>

          {/* Template */}
          <div className="flex items-center gap-4">
            <label className={labelCls}>
              <FileText size={14} className="text-slate-400" /> Template
            </label>
            <select
              value={selectedTemplate}
              onChange={e => setTemplate(e.target.value as any)}
              className={`${fieldCls} cursor-pointer`}
            >
              {myTemplates.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-800 text-white">
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Session type */}
          <div className="flex items-center gap-4">
            <label className={labelCls}>Session type</label>
            <select
              value={sessionType}
              onChange={e => setSessionType(e.target.value as 'in-person' | 'virtual')}
              className={`${fieldCls} cursor-pointer`}
            >
              <option value="virtual" className="bg-slate-800 text-white">Virtual</option>
              <option value="in-person" className="bg-slate-800 text-white">In person</option>
            </select>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-4">
            <label className={labelCls}>
              <Clock size={14} className="text-slate-400" /> Session duration
            </label>
            <input
              type="number"
              min={1}
              max={480}
              value={durationMinutes}
              onChange={e => setDurationMinutes(e.target.value)}
              placeholder="Duration in minutes (optional)"
              className={fieldCls}
            />
          </div>

          {/* Session time */}
          <div className="flex items-center gap-4">
            <label className={labelCls}>
              <Calendar size={14} className="text-slate-400" /> Session time
            </label>
            <input
              type="datetime-local"
              value={sessionTime}
              onChange={e => setSessionTime(e.target.value)}
              className={`${fieldCls} [color-scheme:dark]`}
            />
          </div>

          {/* Summary text */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            placeholder={PLACEHOLDER}
            className="w-full px-4 py-4 bg-white/[0.05] border border-white/[0.12] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm leading-relaxed resize-y"
          />

          {/* Footer: word count + actions */}
          <div className="flex items-center justify-between pt-1">
            <span className={`text-sm ${wordCount >= MIN_WORDS ? 'text-emerald-400' : 'text-slate-400'}`}>
              Number of words: {wordCount} (minimum {MIN_WORDS})
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/capture')}
                className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                Back
              </button>
              <motion.button
                whileHover={{ scale: canGenerate ? 1.02 : 1 }}
                whileTap={{ scale: canGenerate ? 0.97 : 1 }}
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Generating note…
                  </>
                ) : (
                  'Generate note from text'
                )}
              </motion.button>
            </div>
          </div>

          {isGenerating && (
            <p className="text-xs text-slate-400 text-center">
              Expanding your summary into a complete {resolvedTemplate?.name ?? 'clinical'} note — typically 15–30 seconds…
            </p>
          )}
        </motion.div>
      </div>
    </Sidebar>
  );
}
