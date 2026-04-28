import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Layers,
  Sliders,
  FileText,
  HelpCircle,
  ArrowLeft,
  Save,
  AlignLeft,
  List,
  MessageSquare,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { templates as defaultTemplates } from '../data';
import { templatesApi } from '../services/api';
import type { CustomTemplate } from '../services/api';
import toast from 'react-hot-toast';
import type { Template, NoteTemplate } from '../types';

// ── Rich section type used inside the editor ──────────────────────────────────
interface EditorSection {
  id: string;
  title: string;
  verbosity: 'concise' | 'detailed';
  styling: 'paragraph' | 'bullet';
  content: string;
  stylingInstructions: string;
  includeInCopyAll: boolean;
  showAdvanced: boolean;
}

// Default content hints for common SOAP-style sections
const DEFAULT_CONTENT: Record<string, string> = {
  Subjective: "The patient's reported symptoms and medical history.",
  Objective:
    'Any observable and measurable findings about the patient from the conversation.\n\nInclude the following subsections if relevant:\nVital Signs\nPhysical Exam Results\nDiagnostic Test Results and Labs',
  Assessment:
    'Combine subjective and objective data to list detailed diagnoses.\nFor each diagnosis - begin with the diagnosis title, followed by its assessment.',
  Plan: 'For each diagnosis listed in the assessment, provide a detailed plan.',
  'Chief Complaint': 'The primary reason the patient is seeking care today.',
  HPI: "A detailed narrative of the patient's present illness.",
  'Review of Systems': 'Systematic review of body systems relevant to the chief complaint.',
  'Physical Exam': 'Documented findings from the physical examination.',
  'Medical Decision Making': 'Clinical reasoning supporting the diagnosis and treatment plan.',
  'Follow-Up': 'Instructions for follow-up care and next steps.',
  'Patient Instructions':
    'Compose a detailed and well-structured formal email from the doctor to the patient, summarizing the consultation and providing comprehensive care and treatment instructions.',
};

// Sections that default to paragraph styling (everything else defaults to bullet)
const DEFAULT_STYLING: Record<string, 'paragraph' | 'bullet'> = {
  Subjective: 'paragraph',
  'Chief Complaint': 'paragraph',
  HPI: 'paragraph',
  'Medical Decision Making': 'paragraph',
};

const makeSection = (title: string, index: number): EditorSection => ({
  id: `section-${index}-${Date.now() + index}`,
  title,
  verbosity: 'detailed',
  styling: DEFAULT_STYLING[title] ?? 'bullet',
  content: DEFAULT_CONTENT[title] ?? '',
  stylingInstructions: '',
  includeInCopyAll: true,
  showAdvanced: false,
});

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TemplateEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const template = defaultTemplates.find(t => t.id === id);

  const [templateName, setTemplateName] = useState(
    template ? `${template.name} - Copy` : 'New Template'
  );

  const [sections, setSections] = useState<EditorSection[]>(
    (template?.sections?.length
      ? template.sections
      : ['Subjective', 'Objective', 'Assessment', 'Plan']
    ).map((s, i) => makeSection(s, i))
  );

  const [isSaving, setIsSaving] = useState(false);

  // ── Section actions ───────────────────────────────────────────────────────
  const moveUp = (i: number) => {
    if (i === 0) return;
    setSections(prev => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  };

  const moveDown = (i: number) => {
    if (i === sections.length - 1) return;
    setSections(prev => {
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };

  const deleteSection = (i: number) => {
    setSections(prev => prev.filter((_, idx) => idx !== i));
  };

  const addSection = () => {
    setSections(prev => [...prev, makeSection('New Section', prev.length)]);
  };

  const updateSection = (i: number, updates: Partial<EditorSection>) => {
    setSections(prev => prev.map((s, idx) => (idx === i ? { ...s, ...updates } : s)));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (sections.length === 0) {
      toast.error('Add at least one section');
      return;
    }
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));

    // Build the saved template object
    const saved: Template = {
      id: `custom-${Date.now()}` as NoteTemplate,
      name: templateName.trim(),
      description: `Custom version based on ${template?.name ?? 'a template'}`,
      sections: sections.map(s => s.title),
      specialty: template?.specialty ?? 'Custom',
      isCustom: true,
      isDefault: false,
    };

    // Persist to localStorage
    let allIds: string[] = [];
    let allCustom: Template[] = [];
    try {
      const prevTemplates: Template[] = JSON.parse(
        localStorage.getItem('pronote_custom_templates') ?? '[]'
      );
      allCustom = [...prevTemplates, saved];
      localStorage.setItem('pronote_custom_templates', JSON.stringify(allCustom));

      const prevAdded: string[] = JSON.parse(
        localStorage.getItem('pronote_added_ids') ?? '[]'
      );
      allIds = prevAdded.includes(saved.id) ? prevAdded : [...prevAdded, saved.id];
      localStorage.setItem('pronote_added_ids', JSON.stringify(allIds));
    } catch {
      // localStorage unavailable — use in-memory values
      allIds = [saved.id];
      allCustom = [saved];
    }

    // Sync to server so TemplatesPage doesn't overwrite on mount
    try {
      await templatesApi.savePreferences(
        allIds,
        allCustom as unknown as CustomTemplate[]
      );
    } catch {
      // Server unreachable — localStorage is still there
    }

    setIsSaving(false);
    toast.success(`"${saved.name}" saved and added to My Templates!`);
    navigate('/templates');
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen">
        {/* BG glows */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-7xl mx-auto">
          {/* Back */}
          <button
            onClick={() => navigate('/templates')}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-7 transition-colors text-sm font-medium group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Templates
          </button>

          <div className="flex gap-8 items-start">
            {/* ── Main column ── */}
            <div className="flex-1 min-w-0">

              {/* Page heading */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <h1 className="text-2xl font-black text-white mb-1.5 tracking-tight">
                  Edit Template
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  This will create a new version of the template following your edits.
                  The original{' '}
                  <span className="text-white font-semibold">
                    "{template?.name ?? 'template'}"
                  </span>{' '}
                  template will remain available.
                </p>
              </motion.div>

              {/* Template Name */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="mb-7"
              >
                <label className="block text-sm font-semibold text-white mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.12] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm"
                  placeholder="e.g., SOAP - Copy"
                />
              </motion.div>

              {/* Section cards */}
              <AnimatePresence mode="popLayout">
                {sections.map((section, i) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    index={i}
                    total={sections.length}
                    onChange={updates => updateSection(i, updates)}
                    onMoveUp={() => moveUp(i)}
                    onMoveDown={() => moveDown(i)}
                    onDelete={() => deleteSection(i)}
                  />
                ))}
              </AnimatePresence>

              {/* Add Section */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={addSection}
                className="w-full py-3.5 border-2 border-dashed border-white/[0.15] rounded-xl text-slate-400 hover:text-white hover:border-violet-500/40 hover:bg-violet-500/5 transition-all flex items-center justify-center gap-2 font-semibold text-sm mt-2 mb-8"
              >
                <Plus size={16} /> Add Section
              </motion.button>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/templates')}
                  className="flex-1 py-3 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 0 24px rgba(139,92,246,0.4)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-500/25 hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Save Template
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <aside className="hidden lg:block w-72 flex-shrink-0">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="sticky top-8"
              >
                <div className="bg-white/[0.04] border border-white/[0.1] rounded-2xl p-6">
                  <h3 className="font-bold text-white mb-5 text-sm">
                    Template Creation Walkthrough
                  </h3>

                  <div className="space-y-5">
                    <WalkthroughStep
                      icon={<Layers size={15} />}
                      num={1}
                      title="Add sections to your template"
                      desc="This will determine the structure of your note and how information is organized."
                    />
                    <WalkthroughStep
                      icon={<Sliders size={15} />}
                      num={2}
                      title="Define style and verbosity"
                      desc="Match each section to your documentation preferences."
                    />
                    <WalkthroughStep
                      icon={<FileText size={15} />}
                      num={3}
                      title="Use content instructions"
                      desc="Guide what should be included in each section for clarity and consistency."
                    />
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/[0.08] text-center text-xs text-slate-400 leading-relaxed">
                    For examples and additional guidance, visit our{' '}
                    <button
                      onClick={() => navigate('/help')}
                      className="text-violet-400 font-semibold hover:text-violet-300 transition-colors underline underline-offset-2"
                    >
                      Help Center
                    </button>
                  </div>
                </div>
              </motion.div>
            </aside>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
interface SectionCardProps {
  section: EditorSection;
  index: number;
  total: number;
  onChange: (updates: Partial<EditorSection>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function SectionCard({
  section,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SectionCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ delay: index * 0.04, layout: { duration: 0.2 } }}
      className="bg-white/[0.04] border border-white/[0.1] rounded-2xl p-6 mb-4 hover:border-white/20 transition-colors"
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">{section.title}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-2 text-slate-500 hover:text-white disabled:opacity-20 hover:bg-white/10 rounded-lg transition-all"
            title="Move up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-2 text-slate-500 hover:text-white disabled:opacity-20 hover:bg-white/10 rounded-lg transition-all"
            title="Move down"
          >
            <ArrowDown size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/30 transition-all"
            title="Delete section"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Section Title input */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
          Section Title
        </label>
        <input
          type="text"
          value={section.title}
          onChange={e => onChange({ title: e.target.value })}
          className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all text-sm"
        />
      </div>

      {/* Verbosity toggle */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
          Verbosity
        </label>
        <div className="flex rounded-xl overflow-hidden border border-white/[0.1] bg-white/[0.03]">
          {(['concise', 'detailed'] as const).map(v => (
            <button
              key={v}
              onClick={() => onChange({ verbosity: v })}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                section.verbosity === v
                  ? 'bg-violet-500 text-white shadow-inner'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {v === 'concise' ? <FileText size={13} /> : <MessageSquare size={13} />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Styling toggle */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
          Styling
        </label>
        <div className="flex rounded-xl overflow-hidden border border-white/[0.1] bg-white/[0.03]">
          {(['paragraph', 'bullet'] as const).map(s => (
            <button
              key={s}
              onClick={() => onChange({ styling: s })}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                section.styling === s
                  ? 'bg-violet-500 text-white shadow-inner'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s === 'paragraph' ? <AlignLeft size={13} /> : <List size={13} />}
              {s === 'paragraph' ? 'Paragraph' : 'Bullet points'}
            </button>
          ))}
        </div>
      </div>

      {/* Section Content */}
      <div className="mb-4">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
          Section Content
          <HelpCircle size={12} className="text-slate-600" />
        </label>
        <textarea
          value={section.content}
          onChange={e => onChange({ content: e.target.value })}
          rows={4}
          className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all text-sm resize-y leading-relaxed"
          placeholder="Describe what should be captured in this section…"
        />
      </div>

      {/* Advanced Settings toggle */}
      <button
        onClick={() => onChange({ showAdvanced: !section.showAdvanced })}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3 font-medium"
      >
        {section.showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Advanced Settings
      </button>

      <AnimatePresence>
        {section.showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-4"
          >
            {/* Optional Styling Instructions */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Optional Styling Instructions
                <HelpCircle size={12} className="text-slate-600" />
              </label>
              <textarea
                value={section.stylingInstructions}
                onChange={e => onChange({ stylingInstructions: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all text-sm resize-y"
                placeholder="e.g., Use numbered headings for each diagnosis title."
              />
            </div>

            {/* Include in Copy all toggle */}
            <div className="flex items-center gap-3 pb-2">
              <button
                role="switch"
                aria-checked={section.includeInCopyAll}
                onClick={() => onChange({ includeInCopyAll: !section.includeInCopyAll })}
                className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${
                  section.includeInCopyAll ? 'bg-violet-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    section.includeInCopyAll ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-slate-300">Include in "Copy all"</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Walkthrough Step ──────────────────────────────────────────────────────────
interface WalkthroughStepProps {
  icon: React.ReactNode;
  num: number;
  title: string;
  desc: string;
}

function WalkthroughStep({ icon, num, title, desc }: WalkthroughStepProps) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-violet-400">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white leading-snug">
          {num}. {title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
