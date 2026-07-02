import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Save, 
  Download, 
  CheckCircle,
  Clock,
  Edit3,
  Copy,
  MoreVertical,
  User,
  Trash2,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Badge, Modal } from '../components/ui';
import { useNotesStore } from '../store';
import { templates } from '../data';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { ClinicalNote, NoteContent, Template } from '../types';
import { getAuthToken, notesApi } from '../services/api';
import { sectionTitleToKey } from '../utils/sectionKeys';

// Built-in templates that use a dedicated, fixed-key prompt on the backend
// (getDedicatedPrompts in backend/src/routes/audio.ts). For these, section
// titles map to standard SOAP fields. Every other template — custom templates
// and the remaining built-ins — uses buildDynamicPrompt with derived keys.
const DEDICATED_TEMPLATE_IDS = new Set([
  'soap', 'psychiatry', 'therapy', 'pediatrics',
  'cardiology', 'dermatology', 'orthopedics', 'custom',
]);

// The fixed top-level columns NoteContent persists to. Anything else lives in
// customSections. Used to decide where a freshly-typed section should be stored.
const KNOWN_CONTENT_KEYS = new Set([
  'subjective', 'objective', 'assessment', 'plan', 'chiefComplaint',
  'historyOfPresentIllness', 'reviewOfSystems', 'physicalExam',
  'medicalDecisionMaking', 'instructions', 'followUp',
]);

// Pull a short clinical title from the generated note. Prefers the GPT-emitted "topic"
// (a 4-8 word title we ask for in the prompt). Falls back to the first non-empty signal
// from the content fields for older notes that pre-date the topic field.
function deriveNoteTopic(content: NoteContent | undefined): string {
  if (!content) return '';

  // Direct passthrough from GPT (Zod schema is passthrough — modern notes have this).
  if (content.topic && content.topic.trim()) return content.topic.trim();

  // Stored under customSections by the backend create-note handler.
  const fromCustom = content.customSections?.topic;
  if (typeof fromCustom === 'string' && fromCustom.trim()) return fromCustom.trim();

  // Legacy fallback for notes recorded before the topic field existed.
  const candidates = [
    content.chiefComplaint,
    content.assessment,
    content.subjective,
    content.historyOfPresentIllness,
    content.plan,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const firstSentence = trimmed.split(/(?<=[.!?])\s+|\n/)[0].trim();
    return firstSentence.length > 90 ? firstSentence.slice(0, 87) + '…' : firstSentence;
  }
  return '';
}

// Resolve a template id (built-in or custom) to a friendly display name.
function resolveTemplateName(templateId: string | undefined): string {
  if (!templateId) return '';
  const builtIn = templates.find(t => t.id === templateId);
  if (builtIn) return builtIn.name;
  try {
    const customs: Template[] = JSON.parse(
      localStorage.getItem('pronote_custom_templates') ?? '[]'
    );
    const match = customs.find(t => t.id === templateId);
    if (match) return match.name;
  } catch {}
  // Fallback: humanize the id (e.g. "progress-notes" → "Progress Notes").
  return templateId
    .replace(/^custom-\d+$/, 'Custom')
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function NoteEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getNoteById, fetchNoteById, updateNote, deleteNote, markNoteAsRead } = useNotesStore();
  
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [content, setContent] = useState<NoteContent>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNote, setIsLoadingNote] = useState(true);
  const [noteNotFound, setNoteNotFound] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setIsLoadingNote(true);
    setNoteNotFound(false);

    // 1. Check the in-memory store first (instant if available)
    const existingNote = getNoteById(id);
    if (existingNote) {
      setNote(existingNote);
      setContent(existingNote.content);
      setIsLoadingNote(false);
      // Mark as read when opened
      if (!existingNote.isRead) markNoteAsRead(id);
      return;
    }

    // 2. Not in store (e.g. page refresh) — fetch from API
    fetchNoteById(id).then((fetched) => {
      if (cancelled) return;
      if (fetched) {
        setNote(fetched);
        setContent(fetched.content);
        // Mark as read when opened
        if (!fetched.isRead) markNoteAsRead(id);
      } else {
        setNoteNotFound(true);
      }
      setIsLoadingNote(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // A resolved storage location for one rendered section: either a top-level
  // NoteContent field, or a key inside customSections (where the backend stores
  // any section whose title isn't one of the fixed columns).
  type SectionTarget = { key: string; inCustom: boolean; value: string };

  const handleContentChange = (target: SectionTarget, value: string) => {
    setContent(prev => {
      if (target.inCustom) {
        return {
          ...prev,
          customSections: { ...(prev.customSections || {}), [target.key]: value },
        };
      }
      return { ...prev, [target.key]: value };
    });
    setHasChanges(true);
  };

  // Find where a section's text actually lives. This works for ANY template, by
  // resolving keys the SAME way the note was generated:
  //
  //   - The 8 built-in specialty templates use a dedicated prompt with FIXED
  //     standard keys → the big sectionKeyMap (title → standard SOAP field).
  //   - Every other template — all custom templates AND the other built-ins —
  //     uses buildDynamicPrompt with sectionTitleToKey-derived keys, which the
  //     backend stores in customSections when they aren't standard columns.
  //
  // We try the candidate keys in the order that matches the generation scheme,
  // checking both the top-level columns and customSections, and fall back to the
  // other scheme so older notes (generated before the dynamic-prompt change)
  // still resolve. Crucially, for non-dedicated templates the derived key is
  // tried FIRST, so a custom section never accidentally borrows another
  // section's content via a big-map collision.
  const resolveSection = (section: string): SectionTarget => {
    const c = content as Record<string, unknown>;
    const cs = (content.customSections || {}) as Record<string, unknown>;
    const derived = sectionTitleToKey(section);        // dynamic-prompt scheme
    const mapped = sectionKeyMap[section] as string | undefined; // dedicated scheme

    const isDedicated = DEDICATED_TEMPLATE_IDS.has((note?.template || '').toLowerCase());
    const candidates = (
      isDedicated ? [mapped, derived] : [derived, mapped]
    ).filter((k): k is string => !!k && k !== 'customSections');

    for (const k of candidates) {
      if (typeof c[k] === 'string' && c[k]) return { key: k, inCustom: false, value: c[k] as string };
      if (typeof cs[k] === 'string' && cs[k]) return { key: k, inCustom: true, value: cs[k] as string };
    }
    // Older notes sometimes stored the section under its raw title.
    if (typeof cs[section] === 'string' && cs[section]) {
      return { key: section, inCustom: true, value: cs[section] as string };
    }
    // Empty so far — choose a stable write target consistent with the scheme:
    // a standard column if the key is one, otherwise inside customSections.
    const writeKey = candidates[0] || derived;
    return { key: writeKey, inCustom: !KNOWN_CONTENT_KEYS.has(writeKey), value: '' };
  };

  const handleSave = async () => {
    if (!note) return;
    
    setIsSaving(true);
    try {
      await updateNote(note.id, { content, updatedAt: new Date() });
      setNote(prev => prev ? { ...prev, content, updatedAt: new Date() } : null);
      setHasChanges(false);
      toast.success('Note saved successfully');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSign = async () => {
    if (!note) return;
    
    try {
      await handleSave();
      await notesApi.sign(note.id);
      updateNote(note.id, { status: 'signed' });
      setNote(prev => prev ? { ...prev, status: 'signed' } : null);
      setShowSignModal(false);
      toast.success('Note signed and finalized');
    } catch (error) {
      console.error('Sign failed:', error);
      toast.error('Failed to sign note');
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    try {
      await deleteNote(note.id);
      toast.success('Note deleted');
      navigate('/notes');
    } catch {
      toast.error('Failed to delete note');
    }
  };

  const handleCopy = () => {
    const noteText = Object.entries(content)
      .map(([key, value]) => `${key.toUpperCase()}:\n${value}`)
      .join('\n\n');
    navigator.clipboard.writeText(noteText);
    toast.success('Note copied to clipboard');
  };

  const handleExport = () => {
    if (!note?.id) return;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const token = getAuthToken();
    // Open export page in new tab — user can Print → Save as PDF
    const url = `${apiBase}/notes/${note.id}/export?token=${token}`;
    window.open(url, '_blank');
    toast.success('Export opened — use Print (Ctrl+P) to save as PDF');
  };

  const getSections = () => {
    // Built-in templates first.
    const builtIn = templates.find(t => t.id === note?.template);
    if (builtIn?.sections?.length) return builtIn.sections;

    // Fall back to the user's custom templates from localStorage. NoteEditorPage previously
    // ignored custom templates, which meant any note recorded with a user-edited template
    // (e.g. SOAP-with-Patient-Instructions saved as custom-XXX) silently lost extra sections
    // because the renderer fell back to the default 4-section SOAP layout.
    try {
      const customs: Template[] = JSON.parse(
        localStorage.getItem('pronote_custom_templates') ?? '[]'
      );
      const match = customs.find(t => t.id === note?.template);
      if (match?.sections?.length) return match.sections;
    } catch {}

    return ['Subjective', 'Objective', 'Assessment', 'Plan', 'Patient Instructions'];
  };

  const sectionKeyMap: Record<string, keyof NoteContent> = {
    // Core SOAP
    'Subjective': 'subjective',
    'Objective': 'objective',
    'Assessment': 'assessment',
    'Plan': 'plan',
    'Patient Instructions': 'instructions',
    'Instructions': 'instructions',

    // General / multi-specialty
    'Chief Complaint': 'chiefComplaint',
    'History of Present Illness': 'historyOfPresentIllness',
    'History': 'historyOfPresentIllness',
    'Review of Systems': 'reviewOfSystems',
    'Physical Exam': 'physicalExam',
    'Physical Examination Findings': 'physicalExam',
    'Assessment & Plan': 'plan',
    'Follow-Up': 'followUp',
    'Follow-Up Schedule': 'followUp',

    // Progress Notes
    'Letter to Patient': 'instructions',

    // Daily Note
    'Patient Identification': 'chiefComplaint',
    'Medical History': 'historyOfPresentIllness',
    'Current Medications': 'reviewOfSystems',

    // HPI
    'Identifying Information': 'chiefComplaint',
    'Past Medical History': 'historyOfPresentIllness',

    // Chart Notes
    'Date & Provider': 'chiefComplaint',
    'Clinical Findings': 'objective',

    // Chronic Care / Wellness
    'Patient Information': 'chiefComplaint',
    'Care Plan': 'plan',
    'Medications': 'reviewOfSystems',
    'Goals & Education': 'instructions',
    'Health Goals': 'chiefComplaint',
    'Lifestyle Assessment': 'subjective',
    'Nutrition': 'objective',
    'Physical Activity': 'assessment',
    'Mental Wellbeing': 'reviewOfSystems',

    // Psychiatry
    'Mental Status Exam': 'physicalExam',
    'Mental Status': 'physicalExam',
    'Safety Assessment': 'medicalDecisionMaking',
    'Presenting Problem': 'chiefComplaint',
    'Diagnosis': 'assessment',
    'Risk Factors': 'medicalDecisionMaking',
    'Social History': 'reviewOfSystems',

    // Mental Health
    'Client Identification': 'chiefComplaint',
    'Session Narrative': 'subjective',
    'Clinical Observations': 'objective',
    'Progress Evaluation': 'assessment',
    'Plan of Action': 'plan',
    'Demographics': 'chiefComplaint',
    'Presenting Concerns': 'subjective',
    'Psychiatric History': 'historyOfPresentIllness',
    'Substance Use History': 'reviewOfSystems',
    'Family History': 'reviewOfSystems',
    'Diagnosis & Treatment Plan': 'plan',

    // Therapy
    'Session Summary': 'subjective',
    'Interventions': 'assessment',
    'Client Response': 'objective',
    'Client Presentation': 'subjective',
    'Progress': 'assessment',

    // Pediatrics
    'Growth & Development': 'objective',
    'Developmental History': 'historyOfPresentIllness',

    // Cardiology
    'Cardiac History': 'historyOfPresentIllness',
    'ECG/Imaging': 'objective',
    'Diagnostic Findings': 'objective',

    // Dermatology
    'Skin Exam': 'physicalExam',
    'Lesion Description': 'objective',
    'Distribution': 'physicalExam',
    'Associated Symptoms': 'reviewOfSystems',

    // Orthopedics
    'Mechanism of Injury': 'historyOfPresentIllness',
    'Imaging': 'objective',
    'Imaging Findings': 'objective',
    'Injury Mechanism': 'historyOfPresentIllness',
  };

  if (isLoadingNote) {
    return (
      <Sidebar>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading note...</p>
          </div>
        </div>
      </Sidebar>
    );
  }

  if (noteNotFound || !note) {
    return (
      <Sidebar>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <p className="text-xl font-semibold text-white mb-2">Note not found</p>
            <p className="text-slate-400 mb-6">This note may have been deleted or you don't have access to it.</p>
            <button
              onClick={() => navigate('/notes')}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-medium"
            >
              Back to Notes
            </button>
          </div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate('/notes')}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Notes
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{note.patientName}</h1>
                <Badge
                  variant={
                    note.status === 'signed'
                      ? 'success'
                      : note.status === 'completed'
                      ? 'info'
                      : 'warning'
                  }
                >
                  {note.status}
                </Badge>
              </div>
              {(() => {
                const topic = deriveNoteTopic(content);
                return topic ? (
                  <p className="text-xl sm:text-2xl font-semibold text-white mt-1 mb-2 leading-snug">
                    {topic}
                  </p>
                ) : null;
              })()}
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {format(new Date(note.dateOfService), 'MMMM d, yyyy')}
                </span>
                <span>{resolveTemplateName(note.template)} Template</span>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Button
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
                disabled={!hasChanges || note.status === 'signed'}
              >
                <Save size={16} className="mr-1" />
                Save
              </Button>
              {note.status !== 'signed' && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowSignModal(true)}
                >
                  <CheckCircle size={16} className="mr-1" />
                  Sign
                </Button>
              )}

              {/* Three-dot menu */}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="p-2 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  title="More options"
                >
                  <MoreVertical size={17} />
                </button>

                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-2 z-50 w-52 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                      {/* View Patient */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setShowMenu(false);
                          navigate(`/patients/${encodeURIComponent(note.patientName)}`);
                        }}
                      >
                        <User size={15} className="text-blue-400" />
                        View Patient
                      </button>

                      {/* Copy Note */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                        onClick={() => { setShowMenu(false); handleCopy(); }}
                      >
                        <Copy size={15} className="text-slate-400" />
                        Copy Note
                      </button>

                      {/* Export PDF */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                        onClick={() => { setShowMenu(false); handleExport(); }}
                      >
                        <Download size={15} className="text-emerald-400" />
                        Export PDF
                      </button>

                      {note.status !== 'signed' && (
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                          onClick={() => { setShowMenu(false); setShowSignModal(true); }}
                        >
                          <CheckCircle size={15} className="text-blue-400" />
                          Sign Note
                        </button>
                      )}

                      <div className="h-px bg-white/10 mx-3" />

                      {/* Delete */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={() => { setShowMenu(false); setShowDeleteModal(true); }}
                      >
                        <Trash2 size={15} />
                        Delete Note
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Note Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden bg-white/[0.04] border border-white/[0.08]">
            <div className="p-6 space-y-6">
              {getSections().map((section, index) => {
                const target = resolveSection(section);

                return (
                  <motion.div
                    key={section}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className="space-y-2"
                  >
                    <label className="flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                      <Edit3 size={14} className="text-emerald-500" />
                      {section}
                    </label>
                    <textarea
                      value={target.value}
                      onChange={(e) => handleContentChange(target, e.target.value)}
                      disabled={note.status === 'signed'}
                      className={`w-full min-h-[120px] p-4 border border-white/[0.12] rounded-xl resize-y focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400/40 transition-all text-white placeholder-white/25 text-sm leading-relaxed ${
                        note.status === 'signed'
                          ? 'bg-white/[0.03] cursor-not-allowed opacity-70'
                          : 'bg-white/5 hover:bg-white/[0.07]'
                      }`}
                      placeholder={`Enter ${section.toLowerCase()} details...`}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/[0.03] border-t border-white/[0.08]">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>
                  Last updated: {format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a')}
                </span>
                {hasChanges && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Sign Confirmation Modal */}
        <Modal
          isOpen={showSignModal}
          onClose={() => setShowSignModal(false)}
          title="Sign Clinical Note"
        >
          <p className="text-slate-400 mb-4">
            By signing this note, you confirm that:
          </p>
          <ul className="text-sm text-slate-300 space-y-2 mb-6">
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>The information in this note is accurate and complete</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>You have reviewed and verified all sections</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>The note will be locked and cannot be edited after signing</span>
            </li>
          </ul>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowSignModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSign}>
              Sign Note
            </Button>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Note"
        >
          <p className="text-slate-400 mb-6">
            Are you sure you want to delete this note for <span className="text-white font-medium">{note.patientName}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 border-0"
              onClick={handleDelete}
            >
              <Trash2 size={15} className="mr-1.5" />
              Delete Note
            </Button>
          </div>
        </Modal>
      </div>
    </Sidebar>
  );
}
