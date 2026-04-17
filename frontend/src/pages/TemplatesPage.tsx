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
  Eye
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Modal, Input } from '../components/ui';
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
      <div className="p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Note Templates</h1>
              <p className="text-gray-600">
                Choose a template that matches your specialty and workflow
              </p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={18} className="mr-2" />
              Create Template
            </Button>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </motion.div>

        {/* Current Template */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Check size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Currently Selected</p>
                  <p className="text-lg font-semibold text-emerald-800">
                    {templates.find(t => t.id === selectedTemplate)?.name || 'SOAP Note'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/capture')}>
                Start Recording
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Favorites Section */}
        {favoriteTemplates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star size={20} className="text-amber-500" />
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Custom Template"
        >
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
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateTemplate} className="flex-1">
                Create Template
              </Button>
            </div>
          </div>
        </Modal>

        {/* Preview Modal */}
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title={previewTemplate?.name || 'Template Preview'}
        >
          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-gray-700">{previewTemplate.description}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Specialty</p>
                <p className="text-gray-700">{previewTemplate.specialty}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Sections</p>
                <div className="space-y-2">
                  {previewTemplate.sections.map((section, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{section}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)} className="flex-1">
                  Close
                </Button>
                <Button onClick={() => {
                  handleUseTemplate(previewTemplate);
                  setIsPreviewOpen(false);
                }} className="flex-1">
                  Use This Template
                </Button>
              </div>
            </div>
          )}
        </Modal>
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

function TemplateCard({
  template,
  index,
  isSelected,
  isFavorite,
  onToggleFavorite,
  onPreview,
  onDuplicate,
  onUse,
}: TemplateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`p-4 h-full transition-all ${isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'hover:shadow-md'}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-emerald-500' : 'bg-gray-100'}`}>
              <FileText size={20} className={isSelected ? 'text-white' : 'text-gray-500'} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              <p className="text-xs text-gray-500">{template.specialty}</p>
            </div>
          </div>
          <button
            onClick={() => onToggleFavorite(template.id)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isFavorite ? (
              <Star size={18} className="text-amber-500 fill-amber-500" />
            ) : (
              <StarOff size={18} className="text-gray-400" />
            )}
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {template.sections.slice(0, 3).map((section, i) => (
            <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {section}
            </span>
          ))}
          {template.sections.length > 3 && (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
              +{template.sections.length - 3} more
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={isSelected ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onUse(template)}
            className="flex-1"
          >
            {isSelected ? 'Selected' : 'Use'}
          </Button>
          <button
            onClick={() => onPreview(template)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Preview"
          >
            <Eye size={16} className="text-gray-500" />
          </button>
          <button
            onClick={() => onDuplicate(template)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Duplicate"
          >
            <Copy size={16} className="text-gray-500" />
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
