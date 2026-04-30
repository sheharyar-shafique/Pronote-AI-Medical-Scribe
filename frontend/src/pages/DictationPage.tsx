import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  Loader2,
  Wand2,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Select } from '../components/ui';
import { useNotesStore, useSettingsStore } from '../store';
import { templates } from '../data';
import { audioApi, notesApi } from '../services/api';
import toast from 'react-hot-toast';
import type { ClinicalNote, NoteTemplate } from '../types';

export default function DictationPage() {
  const navigate = useNavigate();
  const { addNote } = useNotesStore();
  const { selectedTemplate, setTemplate } = useSettingsStore();
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [patientName, setPatientName] = useState('');
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Process voice commands and punctuation
  const processVoiceCommands = useCallback((text: string): { processed: string; command: string | null } => {
    const lowerText = text.toLowerCase().trim();
    
    // Voice commands
    if (lowerText === 'delete last' || lowerText === 'delete that') {
      return { processed: '', command: 'delete_last' };
    }
    if (lowerText === 'clear all' || lowerText === 'clear everything') {
      return { processed: '', command: 'clear_all' };
    }
    if (lowerText === 'new section' || lowerText === 'next section') {
      return { processed: '\n\n---\n\n', command: null };
    }
    if (lowerText === 'new line' || lowerText === 'next line') {
      return { processed: '\n', command: null };
    }
    if (lowerText === 'new paragraph' || lowerText === 'next paragraph') {
      return { processed: '\n\n', command: null };
    }
    
    // Process punctuation commands in the text
    let processed = text
      .replace(/\bperiod\b/gi, '.')
      .replace(/\bcomma\b/gi, ',')
      .replace(/\bquestion mark\b/gi, '?')
      .replace(/\bexclamation mark\b/gi, '!')
      .replace(/\bexclamation point\b/gi, '!')
      .replace(/\bcolon\b/gi, ':')
      .replace(/\bsemicolon\b/gi, ';')
      .replace(/\bdash\b/gi, '-')
      .replace(/\bhyphen\b/gi, '-')
      .replace(/\bopen parenthesis\b/gi, '(')
      .replace(/\bclose parenthesis\b/gi, ')')
      .replace(/\bopen quote\b/gi, '"')
      .replace(/\bclose quote\b/gi, '"')
      .replace(/\bquote\b/gi, '"');
    
    return { processed, command: null };
  }, []);

  // Handle delete last word
  const deleteLastWord = useCallback(() => {
    setTranscript(prev => {
      const words = prev.trim().split(/\s+/);
      if (words.length > 0) {
        words.pop();
        return words.join(' ') + (words.length > 0 ? ' ' : '');
      }
      return prev;
    });
    if (!isMuted) toast.success('Deleted last word');
  }, [isMuted]);

  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognitionAPI = (window as typeof window & { 
      webkitSpeechRecognition?: typeof SpeechRecognition;
      SpeechRecognition?: typeof SpeechRecognition;
    }).webkitSpeechRecognition || (window as typeof window & { 
      SpeechRecognition?: typeof SpeechRecognition;
    }).SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;
        
        if (result.isFinal) {
          const { processed, command } = processVoiceCommands(transcriptText);
          
          if (command === 'delete_last') {
            deleteLastWord();
          } else if (command === 'clear_all') {
            setTranscript('');
            setInterimTranscript('');
            if (!isMuted) toast.success('Transcript cleared');
          } else {
            finalText += processed;
          }
        } else {
          interim += transcriptText;
        }
      }
      
      if (finalText) {
        setTranscript(prev => prev + finalText);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // Silently handle no-speech, just restart
      } else if (event.error === 'network') {
        toast.error('Network error. Please check your internet connection.');
        setIsListening(false);
      } else if (event.error !== 'aborted') {
        toast.error('Speech recognition error. Please try again.');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Only restart if still supposed to be listening
      if (isListening && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Ignore if already started
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isListening, isMuted, processVoiceCommands, deleteLastWord]);

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimTranscript('');
      toast.success('Dictation stopped');
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      toast.success('Listening... Start speaking');
    }
  };

  const handleClear = () => {
    setTranscript('');
    setInterimTranscript('');
    toast.success('Transcript cleared');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleGenerateNote = async () => {
    if (!transcript.trim()) {
      toast.error('Please dictate some content first');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Generate clinical note using real AI
      toast.loading('Generating clinical note with AI...', { id: 'dictation-process' });
      
      const noteResult = await audioApi.generateNote(
        transcript,
        selectedTemplate,
        patientName || undefined
      );
      
      toast.dismiss('dictation-process');

      // Sanitize GPT content — coerce null/undefined to empty string so the section
      // still renders in the editor (otherwise dropping the key makes the body blank).
      const sanitizedContent: Record<string, unknown> = {};
      if (noteResult.content && typeof noteResult.content === 'object') {
        for (const [key, value] of Object.entries(noteResult.content)) {
          if (typeof value === 'string') {
            sanitizedContent[key] = value;
          } else if (value != null && typeof value === 'object') {
            sanitizedContent[key] = value;
          } else {
            sanitizedContent[key] = '';
          }
        }
      }
      
      // Create the note in the database
      const createdNote = await notesApi.create({
        patientName: patientName || 'Unknown Patient',
        dateOfService: new Date().toISOString().split('T')[0],
        template: selectedTemplate,
        content: sanitizedContent as any,
        transcription: transcript,
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
        status: createdNote.status,
        createdAt: new Date(createdNote.createdAt),
        updatedAt: new Date(createdNote.updatedAt),
      };
      
      addNote(newNote);
      toast.success('Note generated successfully!');
      navigate(`/notes/${newNote.id}`);
    } catch (error: any) {
      console.error('Dictation processing error:', error);
      toast.dismiss('dictation-process');
      const msg = error?.details
        ? `Validation failed: ${error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')}`
        : error.message || 'Failed to generate note';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-black text-white mb-2">Voice Dictation</h1>
          <p className="text-slate-400">
            Dictate your clinical notes directly. Speak naturally and we'll transcribe in real-time.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Dictation Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Controls */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="p-6 bg-white/[0.04] border-white/[0.08]">
                <div className="flex flex-col items-center">
                  {/* Microphone Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleListening}
                    className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                      isListening 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-emerald-500 hover:bg-emerald-600'
                    }`}
                  >
                    {isListening ? (
                      <MicOff size={40} className="text-white" />
                    ) : (
                      <Mic size={40} className="text-white" />
                    )}
                    
                    {/* Pulse Animation */}
                    {isListening && (
                      <>
                        <motion.div
                          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="absolute inset-0 rounded-full bg-red-500"
                        />
                        <motion.div
                          animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                          className="absolute inset-0 rounded-full bg-red-500"
                        />
                      </>
                    )}
                  </motion.button>
                  
                  <p className={`mt-4 font-medium ${isListening ? 'text-red-400' : 'text-slate-400'}`}>
                    {isListening ? 'Listening... Click to stop' : 'Click to start dictation'}
                  </p>
                  
                  {isListening && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 mt-2"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 0.5 }}
                        className="w-2 h-2 bg-red-500 rounded-full"
                      />
                      <span className="text-sm text-slate-400">Recording audio</span>
                    </motion.div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Transcript Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 bg-white/[0.04] border-white/[0.08]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Transcript</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                      title={isMuted ? 'Unmute feedback' : 'Mute feedback'}
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button
                      onClick={handleCopy}
                      disabled={!transcript}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-50"
                      title="Copy transcript"
                    >
                      {isCopied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                    <button
                      onClick={handleClear}
                      disabled={!transcript}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                      title="Clear transcript"
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={transcript + (interimTranscript ? ` ${interimTranscript}` : '')}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Your dictation will appear here... Start speaking or type directly."
                    className="w-full h-64 p-4 border border-white/[0.1] rounded-xl resize-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40 bg-white/5 text-white placeholder-white/25 text-sm"
                  />
                  
                  {interimTranscript && (
                    <span className="absolute bottom-4 left-4 text-slate-500 italic">
                      {interimTranscript}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
                  <span>{transcript.split(/\s+/).filter(Boolean).length} words</span>
                  <span>{transcript.length} characters</span>
                </div>
              </Card>
            </motion.div>

            {/* Generate Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={handleGenerateNote}
                disabled={!transcript.trim() || isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Generating Note...
                  </>
                ) : (
                  <>
                    <Wand2 size={20} className="mr-2" />
                    Generate Clinical Note
                  </>
                )}
              </Button>
            </motion.div>
          </div>

          {/* Settings Panel */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 bg-white/[0.04] border-white/[0.08]">
                <h2 className="text-lg font-bold text-white mb-4">Settings</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter patient name"
                      className="w-full px-4 py-2.5 border border-white/[0.1] rounded-xl focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40 bg-white/5 text-white placeholder-white/25 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Note Template
                    </label>
                    <Select
                      value={selectedTemplate}
                      onChange={(e) => setTemplate(e.target.value as NoteTemplate)}
                      options={templates.map(t => ({ value: t.id, label: t.name }))}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Tips Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6 bg-emerald-500/10 border border-emerald-500/20">
                <h3 className="font-bold text-emerald-400 mb-3">💡 Dictation Tips</h3>
                <ul className="space-y-2 text-sm text-emerald-300/80">
                  <li>• Speak clearly and at a moderate pace</li>
                  <li>• Say "period" or "comma" for punctuation</li>
                  <li>• Use "new line" or "new paragraph" for formatting</li>
                  <li>• Review and edit the transcript before generating</li>
                  <li>• Medical terms are automatically recognized</li>
                </ul>
              </Card>
            </motion.div>

            {/* Quick Commands */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 bg-white/[0.04] border-white/[0.08]">
                <h3 className="font-bold text-white mb-3">Voice Commands</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">"Delete last"</span>
                    <span className="text-slate-500">Remove word</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">"Clear all"</span>
                    <span className="text-slate-500">Reset transcript</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">"New section"</span>
                    <span className="text-slate-500">Start new section</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
