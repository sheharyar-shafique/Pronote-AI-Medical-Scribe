import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Check,
  Plus,
  Star,
  StarOff,
  Search,
  Copy,
  Eye,
  Sparkles
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Modal, Input } from '../components/ui';
import { useSettingsStore } from '../store';
import { templates as defaultTemplates } from '../data';
import toast from 'react-hot-toast';
import type { Template, NoteTemplate } from '../types';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { selectedTemplate, setTemplate } = useSettingsStore();

  const [templates, setTemplates] = useState<Template[]>(defaultTemplates);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [favorites, setFavorites] = useState<string[]>(['soap']);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    sections: '',
    specialty: '',
  });

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleFavorite = (templateId: string) => {
    setFavorites(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    const customTemplate: Template = {
      id: `custom-${Date.now()}` as NoteTemplate,
      name: newTemplate.name,
      description: newTemplate.description || 'Custom template',
      sections: newTemplate.sections.split(',').map(s => s.trim()).filter(Boolean),
      specialty: newTemplate.specialty || 'Custom',
    };

    setTemplates(prev => [...prev, customTemplate]);
    setIsCreateModalOpen(false);
    setNewTemplate({ name: '', description: '', sections: '', specialty: '' });
    toast.success('Template created successfully');
  };

  const handleDuplicateTemplate = (template: Template) => {
    const duplicated: Template = {
      ...template,
      id: `${template.id}-copy-${Date.now()}` as NoteTemplate,
      name: `${template.name} (Copy)`,
    };
    setTemplates(prev => [...prev, duplicated]);
    toast.success('Template duplicated');
  };

  const handleUseTemplate = (template: Template) => {
    setTemplate(template.id);
    toast.success(`Now using ${template.name} template`);
    navigate('/capture');
  };

  const favoriteTemplates = filteredTemplates.filter(t => favorites.includes(t.id));
  const otherTemplates = filteredTemplates.filter(t => !favorites.includes(t.id));

  return (
    <Sidebar>
      <div className="relative min-h-screen">
        {/* BG glows */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <FileText size={17} className="text-white" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Note Templates</h1>
                </div>
                <p className="text-slate-400 ml-12 text-sm">Choose a template that matches your specialty and workflow</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(16,185,129,0.35)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/25 self-start md:self-auto"
              >
                <Plus size={16} /> Create Template
              </motion.button>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
            <div className="relative max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-12 pr-4 py-3 border border-white/[0.1] rounded-xl bg-white/5 text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40 transition-all text-sm"
              />
            </div>
          </motion.div>

          {/* Currently Selected Banner */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Check size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Currently Selected</p>
                  <p className="text-base font-bold text-white">
                    {templates.find(t => t.id === selectedTemplate)?.name || 'SOAP Note'}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/capture')}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold rounded-xl transition-all"
              >
                Start Recording →
              </motion.button>
            </div>
          </motion.div>

          {/* Favorites Section */}
          {favoriteTemplates.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Star size={18} className="text-amber-400 fill-amber-400" />
                Favorites
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteTemplates.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    isSelected={selectedTemplate === template.id}
                    isFavorite={true}
                    onToggleFavorite={handleToggleFavorite}
                    onPreview={handlePreview}
                    onDuplicate={handleDuplicateTemplate}
                    onUse={handleUseTemplate}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* All Templates */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h2 className="text-base font-bold text-white mb-4">
              {favoriteTemplates.length > 0 ? 'All Templates' : 'Available Templates'}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherTemplates.map((template, index) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  index={index}
                  isSelected={selectedTemplate === template.id}
                  isFavorite={false}
                  onToggleFavorite={handleToggleFavorite}
                  onPreview={handlePreview}
                  onDuplicate={handleDuplicateTemplate}
                  onUse={handleUseTemplate}
                />
              ))}
            </div>
          </motion.div>

          {/* Create Template Modal */}
          <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Custom Template">
            <div className="space-y-4">
              <Input
                label="Template Name"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Neurology Assessment"
              />
              <Input
                label="Description"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the template"
              />
              <Input
                label="Sections (comma-separated)"
                value={newTemplate.sections}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, sections: e.target.value }))}
                placeholder="e.g., Chief Complaint, History, Exam, Assessment, Plan"
              />
              <Input
                label="Specialty"
                value={newTemplate.specialty}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, specialty: e.target.value }))}
                placeholder="e.g., Neurology"
              />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleCreateTemplate} className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all">
                  Create Template
                </button>
              </div>
            </div>
          </Modal>

          {/* Preview Modal */}
          <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title={previewTemplate?.name || 'Template Preview'}>
            {previewTemplate && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-white text-sm">{previewTemplate.description}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Specialty</p>
                  <p className="text-white text-sm">{previewTemplate.specialty}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Sections</p>
                  <div className="space-y-2">
                    {previewTemplate.sections.map((section, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                        <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs font-bold border border-emerald-500/30">
                          {index + 1}
                        </span>
                        <span className="text-slate-300 text-sm">{section}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setIsPreviewOpen(false)} className="flex-1 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all">
                    Close
                  </button>
                  <button onClick={() => { handleUseTemplate(previewTemplate); setIsPreviewOpen(false); }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all">
                    Use This Template
                  </button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      </div>
    </Sidebar>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: Template;
  index: number;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onPreview: (template: Template) => void;
  onDuplicate: (template: Template) => void;
  onUse: (template: Template) => void;
}

function TemplateCard({ template, index, isSelected, isFavorite, onToggleFavorite, onPreview, onDuplicate, onUse }: TemplateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div
        className={`group relative overflow-hidden rounded-2xl p-5 h-full transition-all duration-300 flex flex-col ${
          isSelected
            ? 'bg-emerald-500/10 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
            : 'bg-white/[0.04] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-1'
        }`}
        style={isSelected ? { boxShadow: '0 0 30px rgba(16,185,129,0.1)' } : {}}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
              isSelected
                ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                : 'bg-gradient-to-br from-violet-400/30 to-purple-500/30 border border-violet-500/20'
            }`}>
              <FileText size={20} className={isSelected ? 'text-white' : 'text-violet-400'} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{template.name}</h3>
              <p className="text-xs text-slate-500">{template.specialty}</p>
            </div>
          </div>
          <button
            onClick={() => onToggleFavorite(template.id)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isFavorite ? (
              <Star size={16} className="text-amber-400 fill-amber-400" />
            ) : (
              <StarOff size={16} className="text-slate-600 hover:text-amber-400 transition-colors" />
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-3 line-clamp-2 flex-shrink-0">{template.description}</p>

        {/* Section Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
          {template.sections.slice(0, 3).map((section, i) => (
            <span key={i} className="text-xs px-2.5 py-1 bg-white/[0.06] text-slate-400 border border-white/[0.08] rounded-full">
              {section}
            </span>
          ))}
          {template.sections.length > 3 && (
            <span className="text-xs px-2.5 py-1 bg-white/[0.06] text-slate-500 border border-white/[0.08] rounded-full">
              +{template.sections.length - 3} more
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => onUse(template)}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
              isSelected
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-white/[0.08] text-slate-300 hover:bg-white/15 hover:text-white border border-white/[0.1]'
            }`}
          >
            {isSelected ? '✓ Selected' : 'Use'}
          </motion.button>
          <button
            onClick={() => onPreview(template)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-500 hover:text-emerald-400"
            title="Preview"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => onDuplicate(template)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-500 hover:text-blue-400"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Selected glow overlay */}
        {isSelected && <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/[0.04] to-transparent pointer-events-none" />}
      </div>
    </motion.div>
  );
}
