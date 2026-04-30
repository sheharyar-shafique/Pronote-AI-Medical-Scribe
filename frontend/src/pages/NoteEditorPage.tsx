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
import { useNotesStore, useSettingsStore } from '../store';
import { templates } from '../data';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { ClinicalNote, NoteContent, Template } from '../types';
import { getAuthToken } from '../services/api';

// Build a short topic line from the generated note content — picks the first
// non-empty signal in priority order so it works for any template.
function deriveNoteTopic(content: NoteContent | undefined): string {
  if (!content) return '';
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
    // Take the first sentence / line and cap the length so it stays one-liner-friendly.
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
  const { getNoteById, updateNote, addNote, deleteNote } = useNotesStore();
  const { selectedTemplate } = useSettingsStore();
  
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [content, setContent] = useState<NoteContent>({});
  const [isSaving, setIsSaving] = useState(false);
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
    if (id) {
      const existingNote = getNoteById(id);
      if (existingNote) {
        setNote(existingNote);
        setContent(existingNote.content);
      } else {
        // Create a mock note for demo purposes
        const mockNote: ClinicalNote = {
          id,
          userId: '1',
          patientName: 'John Doe',
          dateOfService: new Date(),
          template: selectedTemplate,
          content: {
            subjective: 'Patient presents with symptoms of upper respiratory infection including cough, nasal congestion, and mild sore throat for the past 3 days. No fever reported. Patient denies shortness of breath or chest pain.',
            objective: 'Vitals: BP 120/80, HR 72, Temp 98.6°F, RR 16\nGeneral: Alert and oriented, no acute distress\nHEENT: Mild pharyngeal erythema, no exudates, TMs clear bilaterally\nLungs: Clear to auscultation bilaterally\nHeart: Regular rate and rhythm, no murmurs',
            assessment: '1. Acute upper respiratory infection (J06.9)\n2. Allergic rhinitis (J30.9)',
            plan: '1. Supportive care with rest and fluids\n2. OTC decongestant as needed\n3. Return if symptoms worsen or fever develops\n4. Follow up in 1 week if not improved',
          },
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setNote(mockNote);
        setContent(mockNote.content);
      }
    }
  }, [id, getNoteById, selectedTemplate]);

  const handleContentChange = (section: keyof NoteContent, value: string) => {
    setContent(prev => ({ ...prev, [section]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!note) return;
    
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (getNoteById(note.id)) {
        updateNote(note.id, { content, updatedAt: new Date() });
      } else {
        addNote({ ...note, content });
      }
      
      setHasChanges(false);
      toast.success('Note saved successfully');
    } catch (error) {
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSign = async () => {
    if (!note) return;
    
    await handleSave();
    updateNote(note.id, { status: 'signed' });
    setNote(prev => prev ? { ...prev, status: 'signed' } : null);
    setShowSignModal(false);
    toast.success('Note signed and finalized');
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

  if (!note) {
    return (
      <Sidebar>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading note...</p>
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
                  <p className="text-sm text-slate-300 mb-1.5 italic">{topic}</p>
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
                const key = sectionKeyMap[section] || 'customSections';
                const value = typeof content[key] === 'string' ? content[key] : '';
                
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
                      value={value as string}
                      onChange={(e) => handleContentChange(key, e.target.value)}
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
