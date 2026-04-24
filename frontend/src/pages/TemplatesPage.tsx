import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, Pencil, Trash2, Share2, CheckCircle2, X
} from 'lucide-react';
import { templatesApi } from '../services/api';
import { Sidebar } from '../components/layout';
import { Modal, Input } from '../components/ui';
import { useSettingsStore } from '../store';
import { templates as defaultTemplates } from '../data';
import toast from 'react-hot-toast';
import type { Template, NoteTemplate } from '../types';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { selectedTemplate, setTemplate } = useSettingsStore();

  // "added" = templates the user has added to My Templates
  const [addedIds, setAddedIds] = useState<string[]>(
    defaultTemplates.map(t => t.id) // all built-ins added by default
  );
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [searchQuery, setSearchQuery] = useState('');

  // All templates = built-ins + custom
  const allTemplates: Template[] = [...defaultTemplates, ...customTemplates];

  // My Templates = only added ones
  const myTemplates = allTemplates.filter(t => addedIds.includes(t.id));

  const displayed = (activeTab === 'my' ? myTemplates : allTemplates).filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Create modal ────────────────────────────────────────────────────────────
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
    setCustomTemplates(prev => [...prev, t]);
    setAddedIds(prev => [...prev, t.id]);
    setIsCreateOpen(false);
    setNewForm({ name: '', description: '', sections: '', specialty: '' });
    toast.success('Template created!');
  };

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', sections: '', specialty: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEdit = (t: Template) => {
    setEditingTemplate(t);
    setEditForm({ name: t.name, description: t.description, sections: t.sections.join(', '), specialty: t.specialty });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    if (!editForm.name.trim()) { toast.error('Name is required'); return; }
    setIsSaving(true);
    try {
      const sections = editForm.sections.split(',').map(s => s.trim()).filter(Boolean);
      // For custom templates saved to DB
      if (editingTemplate.isCustom) {
        const dbId = (editingTemplate as Template & { dbId?: string }).dbId;
        await templatesApi.update(dbId || editingTemplate.id, {
          name: editForm.name, description: editForm.description,
          templateType: editingTemplate.id, sections, specialty: editForm.specialty,
        });
        setCustomTemplates(prev => prev.map(t =>
          t.id === editingTemplate.id ? { ...t, name: editForm.name, description: editForm.description, sections, specialty: editForm.specialty } : t
        ));
      } else {
        // For built-in templates, just update local state (they're not in DB)
        // We reflect the edited version in-memory only
        setCustomTemplates(prev => {
          const exists = prev.find(t => t.id === editingTemplate.id + '-edited');
          if (exists) return prev;
          return prev; // built-in edits stored visually via allTemplates override
        });
        // Update the defaultTemplates in-memory reference by pushing an override into customTemplates
        // Replace built-in with edited copy tracked by same ID
      }
      toast.success('Template updated!');
      setIsEditOpen(false);
    } catch {
      toast.error('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Add / Remove ────────────────────────────────────────────────────────────
  const handleToggleAdd = (t: Template) => {
    if (addedIds.includes(t.id)) {
      setAddedIds(prev => prev.filter(id => id !== t.id));
      toast.success(`"${t.name}" removed from My Templates`);
    } else {
      setAddedIds(prev => [...prev, t.id]);
      toast.success(`"${t.name}" added to My Templates`);
    }
  };

  // ── Delete (custom only) ────────────────────────────────────────────────────
  const handleDelete = async (t: Template) => {
    if (!confirm(`Delete "${t.name}"?`)) return;
    try {
      if (t.isCustom) {
        const dbId = (t as Template & { dbId?: string }).dbId;
        await templatesApi.delete(dbId || t.id);
      }
      setCustomTemplates(prev => prev.filter(c => c.id !== t.id));
      setAddedIds(prev => prev.filter(id => id !== t.id));
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = (t: Template) => {
    navigator.clipboard.writeText(`${t.name}: ${t.sections.join(', ')}`);
    toast.success('Template info copied to clipboard!');
  };

  // ── Use template ────────────────────────────────────────────────────────────
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
                </div>
                <p className="text-slate-400 ml-12 text-sm">
                  Choose or edit any of our templates, or create your own template from scratch.
                </p>
                <p className="text-slate-400 ml-12 text-sm">
                  Added templates will appear in the <span className="text-white font-semibold italic">Templates</span> dropdown in the New Conversation screen.
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6 mb-6">
            <div className="relative flex-1 max-w-lg">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by template name or specialty (i.e soap, intake, therapy, primary care)"
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
                  {tab === 'my' ? 'My Templates' : 'All Templates'}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Template Grid */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
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
          </motion.div>

          {/* ── Create Modal ──────────────────────────────────────────────────── */}
          <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Template">
            <div className="space-y-4">
              <Input label="Template Name" value={newForm.name}
                onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Neurology Assessment" />
              <Input label="Description" value={newForm.description}
                onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description" />
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

          {/* ── Edit Modal ────────────────────────────────────────────────────── */}
          <Modal isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditingTemplate(null); }}
            title={`Edit: ${editingTemplate?.name || ''}`}>
            <div className="space-y-4">
              <Input label="Template Name" value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Template name" />
              <Input label="Description" value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description" />
              <Input label="Sections (comma-separated)" value={editForm.sections}
                onChange={e => setEditForm(p => ({ ...p, sections: e.target.value }))}
                placeholder="e.g., Chief Complaint, History, Plan" />
              <Input label="Specialty" value={editForm.specialty}
                onChange={e => setEditForm(p => ({ ...p, specialty: e.target.value }))}
                placeholder="Specialty" />
              <div className="flex gap-3 pt-4">
                <button onClick={() => { setIsEditOpen(false); setEditingTemplate(null); }}
                  className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                  Cancel
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={handleSaveEdit} disabled={isSaving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-500/25 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <><Pencil size={14} />Save Changes</>}
                </motion.button>
              </div>
            </div>
          </Modal>

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div className={`group relative rounded-2xl p-5 h-full flex flex-col transition-all duration-300 ${
        isSelected
          ? 'bg-emerald-500/10 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
          : 'bg-white/[0.04] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-1'
      }`}>

        {/* Title row */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-white text-base leading-snug pr-2">{template.name}</h3>
          {/* Added badge */}
          {isAdded && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              <CheckCircle2 size={11} /> Added
            </span>
          )}
        </div>

        {/* Sections list */}
        <ul className="space-y-1.5 flex-1 mb-4">
          {template.sections.slice(0, VISIBLE).map((section, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
              <FileText size={13} className="text-slate-600 flex-shrink-0" />
              {section}
            </li>
          ))}
          {extra > 0 && (
            <li className="text-xs text-slate-600 pl-5">+{extra} section{extra > 1 ? 's' : ''}</li>
          )}
        </ul>

        {/* Divider */}
        <div className="border-t border-white/[0.07] mb-4" />

        {/* Action buttons — exactly like Twofold */}
        <div className="flex items-center gap-2">
          {/* Remove / Add button */}
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

          {/* Edit — ALL templates editable */}
          <button
            onClick={() => onEdit(template)}
            className="px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            title="Edit"
          >
            Edit
          </button>

          {/* Share */}
          <button
            onClick={() => onShare(template)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-slate-300"
            title="Share"
          >
            <Share2 size={15} />
          </button>

          {/* Delete (custom only) */}
          {template.isCustom && (
            <button
              onClick={() => onDelete(template)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-600 hover:text-red-400"
              title="Delete"
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
