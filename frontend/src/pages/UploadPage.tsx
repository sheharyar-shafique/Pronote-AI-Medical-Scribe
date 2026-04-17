import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileAudio, 
  X, 
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Select, Input } from '../components/ui';
import { useNotesStore, useSettingsStore } from '../store';
import { templates } from '../data';
import { audioApi, notesApi } from '../services/api';
import toast from 'react-hot-toast';
import type { ClinicalNote } from '../types';

export default function UploadPage() {
  const navigate = useNavigate();
  const { addNote } = useNotesStore();
  const { selectedTemplate, setTemplate } = useSettingsStore();
  
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [patientName, setPatientName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidAudioFile(droppedFile)) {
      setFile(droppedFile);
    } else {
      toast.error('Please upload a valid audio file (MP3, WAV, M4A, etc.)');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidAudioFile(selectedFile)) {
      setFile(selectedFile);
    } else {
      toast.error('Please upload a valid audio file (MP3, WAV, M4A, etc.)');
    }
  };

  const isValidAudioFile = (file: File) => {
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/ogg', 'audio/webm'];
    return validTypes.includes(file.type) || file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleProcess = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setProgress(0);
    
    try {
      // Step 1: Upload the audio file
      toast.loading('Uploading audio file...', { id: 'upload-process' });
      setProgress(20);
      const uploadResult = await audioApi.upload(file);
      
      // Step 2: Transcribe with OpenAI Whisper
      toast.loading('Transcribing with AI...', { id: 'upload-process' });
      setProgress(50);
      const transcriptionResult = await audioApi.transcribe(uploadResult.id);
      
      // Step 3: Generate clinical note with GPT-4
      toast.loading('Generating clinical note...', { id: 'upload-process' });
      setProgress(80);
      const noteResult = await audioApi.generateNote(
        transcriptionResult.transcription,
        selectedTemplate,
        patientName || undefined
      );
      
      setProgress(100);
      toast.dismiss('upload-process');
      
      // Step 4: Create the note in the database
      const createdNote = await notesApi.create({
        patientName: patientName || 'Unknown Patient',
        dateOfService: new Date().toISOString().split('T')[0],
        template: selectedTemplate,
        content: noteResult.content,
        transcription: transcriptionResult.transcription,
        audioUrl: uploadResult.url,
      });
      
      // Also add to local store for immediate UI update
      const newNote: ClinicalNote = {
        id: createdNote.id,
        userId: createdNote.userId,
        patientName: createdNote.patientName,
        dateOfService: new Date(createdNote.dateOfService),
        template: createdNote.template,
        content: createdNote.content,
        transcription: createdNote.transcription,
        audioUrl: createdNote.audioUrl,
        status: createdNote.status,
        createdAt: new Date(createdNote.createdAt),
        updatedAt: new Date(createdNote.updatedAt),
      };
      
      addNote(newNote);
      toast.success('Audio processed successfully!');
      navigate(`/notes/${newNote.id}`);
    } catch (error: any) {
      console.error('Upload processing error:', error);
      toast.dismiss('upload-process');
      toast.error(error.message || 'Failed to process audio file');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Audio</h1>
          <p className="text-gray-600">
            Upload a pre-recorded audio file and we'll transcribe it into clinical notes.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upload Area */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="p-6">
                {/* Patient Name */}
                <div className="mb-6">
                  <Input
                    label="Patient Name (Optional)"
                    placeholder="Enter patient name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>

                {/* Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50'
                      : file
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-label="Upload audio file"
                    title="Upload audio file"
                  />

                  {!file ? (
                    <div>
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload size={28} className="text-gray-400" />
                      </div>
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        Drop your audio file here
                      </p>
                      <p className="text-gray-500 mb-4">or click to browse</p>
                      <p className="text-sm text-gray-400">
                        Supports MP3, WAV, M4A, OGG, WebM (Max 500MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                        <FileAudio size={24} className="text-emerald-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile();
                        }}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Remove file"
                      >
                        <X size={20} className="text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress */}
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {progress < 30
                          ? 'Uploading...'
                          : progress < 60
                          ? 'Transcribing audio...'
                          : 'Generating notes...'}
                      </span>
                      <span className="text-sm text-gray-500">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        className="bg-emerald-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Process Button */}
                <div className="mt-6">
                  <Button
                    onClick={handleProcess}
                    disabled={!file || isProcessing}
                    className="w-full"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={20} className="animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      'Generate Clinical Note'
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Settings Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Note Settings</h3>
              
              <Select
                label="Template"
                value={selectedTemplate}
                onChange={(e) => setTemplate(e.target.value as any)}
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
              />

              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Supported Formats</h4>
                <div className="space-y-2">
                  {[
                    { format: 'MP3', status: 'supported' },
                    { format: 'WAV', status: 'supported' },
                    { format: 'M4A', status: 'supported' },
                    { format: 'OGG', status: 'supported' },
                    { format: 'WebM', status: 'supported' },
                  ].map((item) => (
                    <div key={item.format} className="flex items-center gap-2 text-sm">
                      <CheckCircle size={16} className="text-emerald-500" />
                      <span className="text-gray-600">{item.format}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Tips */}
            <Card className="p-6 mt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-500" />
                Best Practices
              </h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Ensure audio is clear and audible</li>
                <li>• Avoid excessive background noise</li>
                <li>• Longer files may take more time</li>
                <li>• Files are deleted after processing</li>
              </ul>
            </Card>
          </motion.div>
        </div>
      </div>
    </Sidebar>
  );
}
