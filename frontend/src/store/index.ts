import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, ClinicalNote, RecordingSession, NoteTemplate } from '../types';
import { 
  authApi, 
  usersApi, 
  notesApi, 
  setAuthToken, 
  getAuthToken,
  ApiError 
} from '../services/api';

// Check if we should use API or local mock
const USE_API = import.meta.env.VITE_USE_API === 'true';

/** Wipe template preference keys so the next logged-in user starts clean */
function clearTemplatePrefs() {
  localStorage.removeItem('pronote_added_ids');
  localStorage.removeItem('pronote_custom_templates');
}

// Helper to convert API user to frontend User type
function mapApiUser(apiUser: any): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.name,
    role: apiUser.role,
    specialty: apiUser.specialty,
    subscriptionStatus: apiUser.subscriptionStatus,
    subscriptionPlan: apiUser.subscriptionPlan,
    trialEndsAt: apiUser.trialEndsAt ? new Date(apiUser.trialEndsAt) : null,
    createdAt: new Date(apiUser.createdAt),
    avatar: apiUser.avatar,
  };
}

// Helper to convert API note to frontend ClinicalNote type
function mapApiNote(apiNote: any): ClinicalNote {
  return {
    id: apiNote.id,
    userId: apiNote.userId,
    patientName: apiNote.patientName,
    patientId: apiNote.patientId,
    dateOfService: new Date(apiNote.dateOfService),
    template: apiNote.template,
    content: apiNote.content || {},
    status: apiNote.status,
    audioUrl: apiNote.audioUrl,
    transcription: apiNote.transcription,
    createdAt: new Date(apiNote.createdAt),
    updatedAt: new Date(apiNote.updatedAt),
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  signup: (email: string, password: string, name: string, specialty: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setSubscriptionStatus: (status: 'active' | 'inactive' | 'trial') => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

interface NotesState {
  notes: ClinicalNote[];
  currentNote: ClinicalNote | null;
  isLoading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  addNote: (note: ClinicalNote) => Promise<void>;
  updateNote: (id: string, updates: Partial<ClinicalNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (note: ClinicalNote | null) => void;
  getNoteById: (id: string) => ClinicalNote | undefined;
  clearError: () => void;
}

interface RecordingState {
  session: RecordingSession;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  startRecording: () => Promise<void>;
  /**
   * Stops recording and returns ALL audio segments produced during the session.
   * Long recordings are auto-segmented every CHUNK_DURATION_MS to keep each
   * segment under Whisper's 25 MB upload limit; consumers should iterate the
   * returned array, transcribe each segment, and concatenate the transcripts.
   * Short recordings produce a single-element array.
   */
  stopRecording: () => Promise<Blob[]>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  setDuration: (duration: number) => void;
}

interface SettingsState {
  selectedTemplate: NoteTemplate;
  autoSave: boolean;
  darkMode: boolean;
  notifications: boolean;
  weeklySummary: boolean;
  noteReminders: boolean;
  productUpdates: boolean;
  setTemplate: (template: NoteTemplate) => void;
  toggleAutoSave: () => void;
  toggleDarkMode: () => void;
  toggleNotifications: () => void;
  toggleWeeklySummary: () => void;
  toggleNoteReminders: () => void;
  toggleProductUpdates: () => void;
  syncSettings: () => Promise<void>;
}

// Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          if (USE_API) {
            // Use raw fetch so we can check status 202 (2FA challenge)
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (res.status === 202 && data.twoFaRequired) {
              set({ isLoading: false });
              // Throw a special error so LoginPage can show the 2FA input
              const err: any = new Error('2FA required');
              err.status = 202;
              err.challengeToken = data.challengeToken;
              throw err;
            }

            if (!res.ok) {
              const err: any = new Error(data.error || 'Login failed');
              err.status = res.status;
              throw err;
            }

            // Clear any template prefs left by a previous account
            clearTemplatePrefs();
            setAuthToken(data.token);
            set({ 
              user: mapApiUser(data.user), 
              token: data.token,
              isAuthenticated: true, 
              isLoading: false 
            });
          } else {
            // Mock login for development
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const user: User = {
              id: '1',
              email,
              name: email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'User',
              role: email.includes('admin') ? 'admin' : 'clinician',
              specialty: 'General Medicine',
              subscriptionStatus: 'active',
              subscriptionPlan: 'practice',
              trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              createdAt: new Date(),
            };
            
            set({ user, isAuthenticated: true, isLoading: false });
          }
        } catch (error) {
          set({ error: (error as any)?.message || 'Login failed', isLoading: false });
          throw error;
        }
      },
      
      loginWithGoogle: async (idToken: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.googleLogin(idToken);
        setAuthToken(response.token);
        clearTemplatePrefs(); // wipe previous account's prefs
        set({
          user: mapApiUser(response.user),
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
        });
        } catch (error) {
          set({ error: (error as any)?.message || 'Google login failed', isLoading: false });
          throw error;
        }
      },

      signup: async (email: string, password: string, name: string, specialty: string) => {
        set({ isLoading: true, error: null });
        
        try {
          if (USE_API) {
            const response = await authApi.signup(email, password, name, specialty);
            clearTemplatePrefs(); // new user starts with clean slate
            set({ 
              user: mapApiUser(response.user), 
              token: response.token,
              isAuthenticated: true, 
              isLoading: false 
            });
          } else {
            // Mock signup for development
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const user: User = {
              id: Date.now().toString(),
              email,
              name,
              role: email.includes('admin') ? 'admin' : 'clinician',
              specialty,
              subscriptionStatus: 'trial',
              subscriptionPlan: 'practice',
              trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              createdAt: new Date(),
            };
            
            set({ user, isAuthenticated: true, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof ApiError ? error.message : 'Signup failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },
      
      logout: () => {
        if (USE_API) {
          authApi.logout().catch(console.error);
        }
        setAuthToken(null);
        set({ user: null, token: null, isAuthenticated: false });
        // Clear all user-specific localStorage on logout
        localStorage.removeItem('notes-storage');
        clearTemplatePrefs();
      },
      
      updateUser: (updates) => {
        const { user } = get();
        if (user) {
          if (USE_API) {
            usersApi.updateProfile(updates).catch(console.error);
          }
          set({ user: { ...user, ...updates } });
        }
      },
      
      setSubscriptionStatus: (status) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, subscriptionStatus: status } });
        }
      },
      
      checkAuth: async () => {
        // Restore token from persisted Zustand state into the API module
        const { token: storedToken } = get();
        if (storedToken) {
          setAuthToken(storedToken);
        }
        
        const token = getAuthToken();
        if (!token) {
          set({ user: null, token: null, isAuthenticated: false });
          return;
        }
        
        if (USE_API) {
          try {
            const user = await authApi.me();
            set({ user: mapApiUser(user), isAuthenticated: true });
          } catch {
            setAuthToken(null);
            set({ user: null, token: null, isAuthenticated: false });
          }
        }
      },
      
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrate: (_state) => {
        // After Zustand rehydrates from localStorage, sync the token to the API module
        return (rehydratedState) => {
          if (rehydratedState?.token) {
            setAuthToken(rehydratedState.token);
          }
        };
      },
    }
  )
);

// Notes Store - Always use API, no local persistence for notes
export const useNotesStore = create<NotesState>()(
    (set, get) => ({
      notes: [],
      currentNote: null,
      isLoading: false,
      error: null,
      
      fetchNotes: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await notesApi.getAll();
          set({ 
            notes: response.notes.map(mapApiNote), 
            isLoading: false 
          });
        } catch (error) {
          const message = error instanceof ApiError ? error.message : 'Failed to fetch notes';
          set({ error: message, isLoading: false, notes: [] });
        }
      },
      
      addNote: async (note) => {
        // Note is already created via API in the capture/dictation/upload pages
        // Just add to local state for immediate UI update
        set((state) => ({ notes: [note, ...state.notes] }));
      },
      
      updateNote: async (id, updates) => {
        // Optimistically update locally
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...updates, updatedAt: new Date() } : note
          ),
          currentNote: state.currentNote?.id === id 
            ? { ...state.currentNote, ...updates, updatedAt: new Date() } 
            : state.currentNote,
        }));
        
        try {
          await notesApi.update(id, {
            patientName: updates.patientName,
            patientId: updates.patientId,
            dateOfService: updates.dateOfService?.toISOString().split('T')[0],
            template: updates.template,
            content: updates.content,
            status: updates.status,
            transcription: updates.transcription,
          });
        } catch (error) {
          console.error('Failed to update note:', error);
        }
      },
      
      deleteNote: async (id) => {
        try {
          await notesApi.delete(id);
        } catch (error) {
          console.error('Failed to delete note:', error);
        }
        
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          currentNote: state.currentNote?.id === id ? null : state.currentNote,
        }));
      },
      
      setCurrentNote: (note) => {
        set({ currentNote: note });
      },
      
      getNoteById: (id) => {
        return get().notes.find((note) => note.id === id);
      },
      
      clearError: () => set({ error: null }),
    })
);

// Auto-segment long recordings every 10 minutes. Each segment is a complete,
// independently-decodable audio file, kept well under Whisper's 25 MB upload
// limit even if the browser ignores audioBitsPerSecond. Consumers transcribe
// each segment in turn and concatenate the transcripts.
const CHUNK_DURATION_MS = 10 * 60 * 1000;

// Module-scoped session state for the auto-rotation. Sits outside zustand
// because timers and live recorder references aren't useful as React state
// and reading them via get() across closures gets fiddly.
interface ChunkingSession {
  stream: MediaStream;
  recorderOpts: MediaRecorderOptions;
  completedSegments: Blob[];
  currentRecorder: MediaRecorder;
  currentChunks: Blob[];
  segmentTimer: ReturnType<typeof setTimeout> | null;
  isPaused: boolean;
  finalize: () => Promise<Blob[]>;
}
let chunking: ChunkingSession | null = null;

// Recording Store
export const useRecordingStore = create<RecordingState>()((set, get) => ({
  session: {
    id: '',
    status: 'idle',
    duration: 0,
  },
  mediaRecorder: null,
  audioChunks: [],
  startRecording: async () => {
    try {
      // Mono channel + browser-default sample rate. Whisper resamples to 16kHz internally,
      // and forcing sampleRate: 16000 in getUserMedia caused intermittent failures on desktop
      // where the audio device couldn't honor the constraint.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const mimeType =
        candidates.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';

      // Cap bitrate at 24 kbps mono Opus. Combined with auto-segmentation, this keeps
      // each segment small even if the browser silently overrides the bitrate hint.
      const recorderOpts: MediaRecorderOptions = { audioBitsPerSecond: 24000 };
      if (mimeType) recorderOpts.mimeType = mimeType;

      // Build a fresh MediaRecorder for the next segment. Returns the recorder + the
      // closure-scoped chunks array it accumulates into.
      const buildRecorder = () => {
        const rec = new MediaRecorder(stream, recorderOpts);
        const chunks: Blob[] = [];
        rec.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
            // Mirror to the store so the legacy audioChunks consumer keeps showing live size.
            const live = chunking?.currentChunks ?? [];
            live.push(event.data);
            set({ audioChunks: [...live] });
          }
        };
        rec.start();
        return { rec, chunks };
      };

      // Build the FIRST recorder and seed the chunking session.
      const first = buildRecorder();
      const session: ChunkingSession = {
        stream,
        recorderOpts,
        completedSegments: [],
        currentRecorder: first.rec,
        currentChunks: first.chunks,
        segmentTimer: null,
        isPaused: false,
        finalize: () => Promise.resolve([]),
      };

      const finalizeCurrent = (): Promise<void> =>
        new Promise<void>((resolve) => {
          const rec = session.currentRecorder;
          const chunks = session.currentChunks;
          rec.onstop = () => {
            if (chunks.length > 0) {
              const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
              if (blob.size > 0) session.completedSegments.push(blob);
            }
            resolve();
          };
          // If already inactive (e.g. error path), just resolve.
          if (rec.state === 'inactive') resolve();
          else rec.stop();
        });

      const rotate = async () => {
        // Don't rotate while paused — re-arm the timer when the user resumes.
        if (session.isPaused) {
          scheduleRotate();
          return;
        }
        await finalizeCurrent();
        const next = buildRecorder();
        session.currentRecorder = next.rec;
        session.currentChunks = next.chunks;
        // Reset the live mirror so duration display starts fresh per segment.
        set({ audioChunks: [...next.chunks], mediaRecorder: next.rec });
        scheduleRotate();
      };

      const clearTimer = () => {
        if (session.segmentTimer) {
          clearTimeout(session.segmentTimer);
          session.segmentTimer = null;
        }
      };

      const scheduleRotate = () => {
        clearTimer();
        session.segmentTimer = setTimeout(() => {
          rotate().catch((err) => console.error('[recording] segment rotation failed:', err));
        }, CHUNK_DURATION_MS);
      };

      session.finalize = async (): Promise<Blob[]> => {
        clearTimer();
        await finalizeCurrent();
        try {
          stream.getTracks().forEach(track => track.stop());
        } catch {}
        return session.completedSegments.slice();
      };

      chunking = session;
      scheduleRotate();

      set({
        mediaRecorder: first.rec,
        audioChunks: [],
        session: {
          id: Date.now().toString(),
          status: 'recording',
          startTime: new Date(),
          duration: 0,
        },
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  },
  stopRecording: async () => {
    const session = chunking;
    if (!session) return [];
    const segments = await session.finalize();
    chunking = null;
    // Build a combined blob for any legacy consumers that still read it from the store.
    const combinedType = segments[0]?.type || 'audio/webm';
    const combined = segments.length > 0 ? new Blob(segments, { type: combinedType }) : undefined;
    set({
      session: {
        ...get().session,
        status: 'completed',
        audioBlob: combined,
      },
      mediaRecorder: null,
    });
    return segments;
  },
  pauseRecording: () => {
    const session = chunking;
    if (session && session.currentRecorder.state === 'recording') {
      session.isPaused = true;
      session.currentRecorder.pause();
      set({ session: { ...get().session, status: 'paused' } });
    }
  },
  resumeRecording: () => {
    const session = chunking;
    if (session && session.currentRecorder.state === 'paused') {
      session.isPaused = false;
      session.currentRecorder.resume();
      set({ session: { ...get().session, status: 'recording' } });
    }
  },
  resetRecording: () => {
    const session = chunking;
    if (session) {
      try {
        if (session.segmentTimer) clearTimeout(session.segmentTimer);
        if (session.currentRecorder.state !== 'inactive') {
          session.currentRecorder.stop();
        }
        session.stream.getTracks().forEach(track => track.stop());
      } catch {}
      chunking = null;
    }
    set({
      session: { id: '', status: 'idle', duration: 0 },
      mediaRecorder: null,
      audioChunks: [],
    });
  },
  setDuration: (duration) => {
    set({ session: { ...get().session, duration } });
  },
}));

// Settings Store
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedTemplate: 'soap',
      autoSave: true,
      darkMode: false,
      notifications: true,
      weeklySummary: true,
      noteReminders: true,
      productUpdates: false,
      setTemplate: (template) => set({ selectedTemplate: template }),
      toggleAutoSave: () => set((state) => ({ autoSave: !state.autoSave })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      toggleNotifications: () => set((state) => ({ notifications: !state.notifications })),
      toggleWeeklySummary: () => set((state) => ({ weeklySummary: !state.weeklySummary })),
      toggleNoteReminders: () => set((state) => ({ noteReminders: !state.noteReminders })),
      toggleProductUpdates: () => set((state) => ({ productUpdates: !state.productUpdates })),
      syncSettings: async () => {
        if (!USE_API) return;
        try {
          const settings = await usersApi.getSettings();
          set({
            selectedTemplate: settings.defaultTemplate as NoteTemplate,
            autoSave: settings.autoSave,
            darkMode: settings.darkMode,
            notifications: settings.notificationsEnabled,
          });
        } catch (error) {
          console.error('Failed to sync settings:', error);
        }
      },
    }),
    {
      name: 'settings-storage',
    }
  )
);
