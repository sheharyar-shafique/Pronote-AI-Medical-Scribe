import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, Trash2, Share2, CheckCircle2, X, Tag
} from 'lucide-react';
import { templatesApi } from '../services/api';
import { Sidebar } from '../components/layout';
import { Modal, Input } from '../components/ui';
import { useSettingsStore } from '../store';
import { templates as defaultTemplates } from '../data';
import toast from 'react-hot-toast';
import type { Template, NoteTemplate } from '../types';

// ── Derive unique specialty list from default templates ──────────────────────
const ALL_SPECIALTIES = 'All';
const specialtyList = [
  ALL_SPECIALTIES,
  ...Array.from(new Set(defaultTemplates.map(t => t.specialty))),
];

// Specialty → accent color map
const SPECIALTY_COLORS: Record<string, string> = {
  General:              'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Psychiatry:           'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'Mental Health':      'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Therapy:              'bg-pink-500/15 text-pink-300 border-pink-500/30',
  'Physical Therapy':   'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Occupational Therapy': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Speech Therapy':     'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  Nursing:              'bg-teal-500/15 text-teal-300 border-teal-500/30',
  Pediatrics:           'bg-green-500/15 text-green-300 border-green-500/30',
  Cardiology:           'bg-red-500/15 text-red-300 border-red-500/30',
  Dermatology:          'bg-rose-500/15 text-rose-300 border-rose-500/30',
  Orthopedics:          'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  Dietetics:            'bg-lime-500/15 text-lime-300 border-lime-500/30',
  Administrative:       'bg-slate-500/15 text-slate-300 border-slate-500/30',
  Custom:               'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { selectedTemplate, setTemplate } = useSettingsStore();

  // "added" = templates the user has added to My Templates.
  // localStorage is the single source of truth after the first visit.
  // On first visit (no stored key) we seed with all built-ins and save them.
  // On subsequent visits we use exactly what's stored — never re-merge built-ins,
  // so templates the user removed stay removed across page reloads and logins.
  const [addedIds, setAddedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('pronote_added_ids');
      if (raw !== null) return JSON.parse(raw) as string[];
      const builtIn = defaultTemplates.map(t => t.id);
      localStorage.setItem('pronote_added_ids', JSON.stringify(builtIn));
      return builtIn;
    } catch {
      return defaultTemplates.map(t => t.id);
    }
  });

  const [customTemplates, setCustomTemplates] = useState<Template[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pronote_custom_templates') ?? '[]');
    } catch {
      return [];
    }
  });

  // ── Server sync: load on mount, overrides localStorage with server data ──────
  useEffect(() => {
    templatesApi.getPreferences().then(res => {
      if (res.preferences) {
        // Server has data — it is authoritative, overwrite local state
        const { addedIds: serverIds, customTemplates: serverCustom } = res.preferences;
        setAddedIds(serverIds);
        setCustomTemplates(serverCustom as unknown as Template[]);
        try {
          localStorage.setItem('pronote_added_ids', JSON.stringify(serverIds));
          localStorage.setItem('pronote_custom_templates', JSON.stringify(serverCustom));
        } catch {}
      } else {
        // Server has no data yet — bootstrap: push localStorage state up so other
        // devices can pick it up immediately.
        try {
          const rawIds = localStorage.getItem('pronote_added_ids');
          const rawCustom = localStorage.getItem('pronote_custom_templates');
          const ids: string[] = rawIds ? JSON.parse(rawIds) : defaultTemplates.map(t => t.id);
          const customs: Template[] = rawCustom ? JSON.parse(rawCustom) : [];
          templatesApi
            .savePreferences(ids, customs as unknown as import('../services/api').CustomTemplate[])
            .catch(() => {});
        } catch {}
      }
    }).catch(() => {
      // Server unavailable — silently use localStorage
    });
  }, []);

  /** Persist to both localStorage (fast) and server (cross-device) */
  const persistPreferences = (ids: string[], customs: Template[]) => {
    try {
      localStorage.setItem('pronote_added_ids', JSON.stringify(ids));
      localStorage.setItem('pronote_custom_templates', JSON.stringify(customs));
    } catch {}
    templatesApi.savePreferences(ids, customs as unknown as import('../services/api').CustomTemplate[]).catch(() => {});
  };
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(ALL_SPECIALTIES);

  // All built-in templates (never includes custom — those live only in My Templates)
  const allTemplates: Template[] = [...defaultTemplates];

  // My Templates = added built-ins + all custom/edited templates
  const myTemplates = [...defaultTemplates, ...customTemplates].filter(t => addedIds.includes(t.id));

  // "All" tab shows only built-ins; "My" tab shows the user's personal list
  const displayed = (activeTab === 'my' ? myTemplates : allTemplates)
    .filter(t =>
      (selectedSpecialty === ALL_SPECIALTIES || t.specialty === selectedSpecialty) &&
      (
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

  // ── Create modal ─────────────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', description: '', sections: '', specialty: '' });

  const handleCreate = () => {
    if (!newForm.name.trim()) { toast.error('Template name is required'); return; }
    const t: Template = {
      id: `custom-${Date.now()}` as NoteTemplate,
      name: newForm.name,
      description: newForm.description || 'Custom template',
      sections: newForm.sections.split(',').map(s => s.trim()).filter(Boolean),
      specialty: newForm.specialty || 'Custom',
      isCustom: true,
      isDefault: false,
    };
    const nextTemplates = [...customTemplates, t];
    const nextAdded = [...addedIds, t.id];
    setCustomTemplates(nextTemplates);
    setAddedIds(nextAdded);
    persistPreferences(nextAdded, nextTemplates);
    setIsCreateOpen(false);
    setNewForm({ name: '', description: '', sections: '', specialty: '' });
    toast.success('Template created and added to My Templates!');
  };

  // ── Edit — navigate to full editor page ─────────────────────────────────────
  const handleOpenEdit = (t: Template) => {
    navigate(`/templates/${t.id}/edit`);
  };

  // ── Add / Remove ─────────────────────────────────────────────────────────────
  const handleToggleAdd = (t: Template) => {
    if (addedIds.includes(t.id)) {
      const next = addedIds.filter(id => id !== t.id);
      setAddedIds(next);
      persistPreferences(next, customTemplates);
      toast.success(`"${t.name}" removed from My Templates`);
    } else {
      const next = [...addedIds, t.id];
      setAddedIds(next);
      persistPreferences(next, customTemplates);
      toast.success(`"${t.name}" added to My Templates`);
    }
  };

  // ── Delete (custom only) ─────────────────────────────────────────────────────
  const handleDelete = async (t: Template) => {
    if (!confirm(`Delete "${t.name}"?`)) return;
    try {
      if (t.isCustom) {
        const dbId = (t as Template & { dbId?: string }).dbId;
        await templatesApi.delete(dbId || t.id);
      }
      const nextTemplates = customTemplates.filter(c => c.id !== t.id);
      const nextAdded = addedIds.filter(id => id !== t.id);
      setCustomTemplates(nextTemplates);
      setAddedIds(nextAdded);
      persistPreferences(nextAdded, nextTemplates);
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  // ── Share ─────────────────────────────────────────────────────────────────────
  const handleShare = (t: Template) => {
    navigator.clipboard.writeText(`${t.name}: ${t.sections.join(', ')}`);
    toast.success('Template info copied to clipboard!');
  };

  // ── Use template ──────────────────────────────────────────────────────────────
  const handleUse = (t: Template) => {
    setTemplate(t.id);
    toast.success(`Now using "${t.name}"`);
    navigate('/capture');
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen">
        {/* BG glows */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-7xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <FileText size={17} className="text-white" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Template Library</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.1] text-slate-400 text-xs font-semibold">
                    {allTemplates.length} templates
                  </span>
                </div>
                <p className="text-slate-400 ml-12 text-sm">
                  Choose or edit any of our templates, or create your own from scratch.
                </p>
                <p className="text-slate-400 ml-12 text-sm">
                  Added templates appear in the <span className="text-white font-semibold italic">Templates</span> dropdown in the New Conversation screen.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(16,185,129,0.35)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/25 self-start md:self-auto whitespace-nowrap"
              >
                <Plus size={16} /> Create New Template
              </motion.button>
            </div>
          </motion.div>

          {/* Search + Tabs */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6 mb-4">
            <div className="relative flex-1 max-w-lg">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, specialty or keyword…"
                className="w-full pl-10 pr-4 py-2.5 border border-white/[0.1] rounded-xl bg-white/5 text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40 transition-all text-sm"
              />
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl overflow-hidden border border-white/[0.1] bg-white/[0.04] self-start sm:self-auto">
              {(['my', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 text-sm font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'my'
                    ? `My Templates (${myTemplates.length})`
                    : `All Templates (${allTemplates.length})`}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Specialty filter pills */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            className="flex flex-wrap gap-2 mb-6"
          >
            {specialtyList.map(sp => (
              <button
                key={sp}
                onClick={() => setSelectedSpecialty(sp)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedSpecialty === sp
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-white/[0.04] border-white/[0.1] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                {sp !== ALL_SPECIALTIES && <Tag size={10} />}
                {sp}
              </button>
            ))}
          </motion.div>

          {/* Template Grid */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {displayed.length === 0 ? (
                <div className="col-span-3 text-center py-16 text-slate-500">
                  {activeTab === 'my'
                    ? 'No templates added yet. Go to "All Templates" to add some.'
                    : 'No templates match your search.'}
                </div>
              ) : (
                displayed.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    isSelected={selectedTemplate === template.id}
                    isAdded={addedIds.includes(template.id)}
                    onToggleAdd={handleToggleAdd}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                    onShare={handleShare}
                    onUse={handleUse}
                  />
                ))
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Create Modal ────────────────────────────────────────────────────── */}
          <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Template">
            <div className="space-y-4">
              <Input label="Template Name" value={newForm.name}
                onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Neurology Assessment" />
              <Input label="Description" value={newForm.description}
                onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this template" />
              <Input label="Sections (comma-separated)" value={newForm.sections}
                onChange={e => setNewForm(p => ({ ...p, sections: e.target.value }))}
                placeholder="e.g., Chief Complaint, History, Exam, Plan" />
              <Input label="Specialty" value={newForm.specialty}
                onChange={e => setNewForm(p => ({ ...p, specialty: e.target.value }))}
                placeholder="e.g., Neurology" />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleCreate}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all">
                  Create Template
                </button>
              </div>
            </div>
          </Modal>

          {/* Edit navigates to /templates/:id/edit — no modal needed */}

        </div>
      </div>
    </Sidebar>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────
interface TemplateCardProps {
  template: Template;
  index: number;
  isSelected: boolean;
  isAdded: boolean;
  onToggleAdd: (t: Template) => void;
  onEdit: (t: Template) => void;
  onDelete: (t: Template) => void;
  onShare: (t: Template) => void;
  onUse: (t: Template) => void;
}

function TemplateCard({ template, index, isSelected, isAdded, onToggleAdd, onEdit, onDelete, onShare, onUse }: TemplateCardProps) {
  const VISIBLE = 4;
  const extra = template.sections.length - VISIBLE;
  const badgeClass = SPECIALTY_COLORS[template.specialty] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/30';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.035, 0.4) }}
    >
      <div className={`group relative rounded-2xl p-5 h-full flex flex-col transition-all duration-300 ${
        isSelected
          ? 'bg-emerald-500/10 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
          : 'bg-white/[0.04] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-1'
      }`}>

        {/* Specialty badge + Added badge */}
        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${badgeClass}`}>
            <Tag size={9} />
            {template.specialty}
          </span>
          {isAdded && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              <CheckCircle2 size={11} /> Added
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-white text-base leading-snug mb-1.5">{template.name}</h3>

        {/* Description */}
        <p className="text-slate-500 text-xs leading-relaxed mb-3 line-clamp-2">{template.description}</p>

        {/* Sections list */}
        <ul className="space-y-1.5 flex-1 mb-4">
          {template.sections.slice(0, VISIBLE).map((section, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
              <FileText size={13} className="text-slate-600 flex-shrink-0" />
              {section}
            </li>
          ))}
          {extra > 0 && (
            <li className="text-xs text-slate-600 pl-5">+{extra} more section{extra > 1 ? 's' : ''}</li>
          )}
          {template.sections.length === 0 && (
            <li className="text-xs text-slate-600 italic">No sections defined yet</li>
          )}
        </ul>

        {/* Divider */}
        <div className="border-t border-white/[0.07] mb-4" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Remove / Add */}
          <button
            onClick={() => onToggleAdd(template)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-semibold transition-all flex-1 justify-center ${
              isAdded
                ? 'border-red-400/40 text-red-400 hover:bg-red-500/10'
                : 'border-emerald-400/40 text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            {isAdded ? <><X size={14} /> Remove</> : <><Plus size={14} /> Add</>}
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(template)}
            className="px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            title="Edit template"
          >
            Edit
          </button>

          {/* Share */}
          <button
            onClick={() => onShare(template)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-slate-300"
            title="Copy template info"
          >
            <Share2 size={15} />
          </button>

          {/* Delete (custom only) */}
          {template.isCustom && (
            <button
              onClick={() => onDelete(template)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-600 hover:text-red-400"
              title="Delete template"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Use button when selected */}
        {isSelected && (
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => onUse(template)}
            className="mt-3 w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20"
          >
            ✓ Currently Selected — Start Recording
          </motion.button>
        )}

        {isSelected && <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/[0.04] to-transparent pointer-events-none" />}
      </div>
    </motion.div>
  );
}
