import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Save, 
  Download, 
  CheckCircle,
  Clock,
  Edit3,
  Copy
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Badge, Modal } from '../components/ui';
import { useNotesStore, useSettingsStore } from '../store';
import { templates } from '../data';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { ClinicalNote, NoteContent } from '../types';

export default function NoteEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getNoteById, updateNote, addNote } = useNotesStore();
  const { selectedTemplate } = useSettingsStore();
  
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [content, setContent] = useState<NoteContent>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

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

  const handleCopy = () => {
    const noteText = Object.entries(content)
      .map(([key, value]) => `${key.toUpperCase()}:\n${value}`)
      .join('\n\n');
    navigator.clipboard.writeText(noteText);
    toast.success('Note copied to clipboard');
  };

  const handleExport = () => {
    // Simulate export
    toast.success('Note exported successfully');
  };

  const getSections = () => {
    const template = templates.find(t => t.id === note?.template);
    return template?.sections || ['Subjective', 'Objective', 'Assessment', 'Plan'];
  };

  const sectionKeyMap: Record<string, keyof NoteContent> = {
    'Subjective': 'subjective',
    'Objective': 'objective',
    'Assessment': 'assessment',
    'Plan': 'plan',
    'Chief Complaint': 'chiefComplaint',
    'History of Present Illness': 'historyOfPresentIllness',
    'History': 'historyOfPresentIllness',
    'Mental Status Exam': 'physicalExam',
    'Physical Exam': 'physicalExam',
    'Review of Systems': 'reviewOfSystems',
    'Session Summary': 'subjective',
    'Interventions': 'assessment',
    'Client Response': 'objective',
    'Progress': 'assessment',
    'Growth & Development': 'objective',
    'Cardiac History': 'historyOfPresentIllness',
    'ECG/Imaging': 'objective',
    'Skin Exam': 'physicalExam',
    'Lesion Description': 'objective',
    'Mechanism of Injury': 'historyOfPresentIllness',
    'Imaging': 'objective',
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
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Notes
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{note.patientName}</h1>
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
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {format(new Date(note.dateOfService), 'MMMM d, yyyy')}
                </span>
                <span className="capitalize">{note.template} Template</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy size={16} className="mr-1" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download size={16} className="mr-1" />
                Export
              </Button>
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
            </div>
          </div>
        </motion.div>

        {/* Note Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden">
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
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      <Edit3 size={14} className="text-emerald-600" />
                      {section}
                    </label>
                    <textarea
                      value={value as string}
                      onChange={(e) => handleContentChange(key, e.target.value)}
                      disabled={note.status === 'signed'}
                      className={`w-full min-h-[120px] p-4 border border-gray-200 rounded-xl resize-y focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        note.status === 'signed' ? 'bg-gray-50' : ''
                      }`}
                      placeholder={`Enter ${section.toLowerCase()} details...`}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  Last updated: {format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a')}
                </span>
                {hasChanges && (
                  <span className="text-amber-600 flex items-center gap-1">
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
          <p className="text-gray-600 mb-4">
            By signing this note, you confirm that:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 mb-6">
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
      </div>
    </Sidebar>
  );
}
