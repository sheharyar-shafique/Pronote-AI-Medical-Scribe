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
  fetchNoteById: (id: string) => Promise<ClinicalNote | null>;
  addNote: (note: ClinicalNote) => Promise<void>;
  updateNote: (id: string, updates: Partial<ClinicalNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (note: ClinicalNote | null) => void;
  getNoteById: (id: string) => ClinicalNote | undefined;
  clearError: () => void;
}

interface RecordingState {
  session: RecordingSession;
  /**
   * Live transcript built up by Deepgram during recording. Updates in
   * near-real-time (interim results visible while user speaks; final
   * committed text appended ~300ms after each phrase). On stopRecording()
   * resolution, this equals the returned transcript string.
   */
  liveTranscript: string;
  /** Most recent non-final partial; updates rapidly as user speaks. */
  liveInterim: string;
  /** Human-readable status detail for the UI (errors, connecting, etc.). */
  recordingStatusDetail: string | null;
  /**
   * Wall-clock anchors for the session timer. The displayed duration is
   * computed as (now - recordingStartedAt - pausedTotalMs) rather than by
   * counting interval ticks — tick counting drifts badly (each tick's delay is
   * lost) and Chrome throttles background-tab timers, which made the timer run
   * ~25% slow whenever the tab wasn't focused.
   */
  recordingStartedAt: number | null;
  pausedAt: number | null;
  pausedTotalMs: number;
  startRecording: () => Promise<void>;
  /**
   * Stops recording, flushes the Deepgram stream, and returns the final
   * transcribed text. No upload-after-stop step — transcription already
   * happened during recording, so this resolves in <1 second.
   */
  stopRecording: () => Promise<string>;
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
          } catch (error) {
            // Only clear the session when the server explicitly rejected the
            // token (401/403). Network failures, 5xx during a backend deploy,
            // or rate-limit 429s are transient — logging the user out for
            // those caused random mid-session logouts.
            const status = error instanceof ApiError ? error.status : 0;
            if (status === 401 || status === 403) {
              setAuthToken(null);
              set({ user: null, token: null, isAuthenticated: false });
            }
            // Otherwise keep the persisted session; the next successful
            // request will confirm it.
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

      fetchNoteById: async (id: string) => {
        try {
          const apiNote = await notesApi.getById(id);
          const note = mapApiNote(apiNote);
          // Add or update this note in the local store
          set((state) => {
            const exists = state.notes.some((n) => n.id === id);
            return {
              notes: exists
                ? state.notes.map((n) => (n.id === id ? note : n))
                : [note, ...state.notes],
            };
          });
          return note;
        } catch (error) {
          console.error('Failed to fetch note by ID:', error);
          return null;
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

// ──────────────────────────────────────────────────────────────────────────────
// Recording flow: Deepgram WebSocket streaming.
//
// Replaces the previous Whisper batch-upload flow entirely. The old design
// recorded to in-memory blobs, auto-segmented every 5 min / 18 MB to dodge
// Whisper's 25 MB limit, then on Stop uploaded each segment + ran 4-9 parallel
// Whisper calls + ran GPT — the wait after Stop scaled with recording length
// and frequently failed altogether on long mobile recordings.
//
// New flow: audio streams to Deepgram live as the user speaks. Transcripts
// arrive within ~300ms. On Stop, the transcript is already complete — only
// the GPT note-generation call remains, so wait time is constant ~15-30s
// regardless of whether the recording was 1 min or 2 hours.
// ──────────────────────────────────────────────────────────────────────────────
import { DeepgramRecorder } from '../services/deepgram';

// Module-scoped active recorder. Outside zustand because the recorder
// holds live WebSocket / MediaStream resources that aren't serializable
// React state and reading them via get() across closures gets fiddly.
let activeRecorder: DeepgramRecorder | null = null;

// Recording Store
export const useRecordingStore = create<RecordingState>()((set, get) => ({
  session: {
    id: '',
    status: 'idle',
    duration: 0,
  },
  liveTranscript: '',
  liveInterim: '',
  recordingStatusDetail: null,
  recordingStartedAt: null,
  pausedAt: null,
  pausedTotalMs: 0,

  startRecording: async () => {
    // Tear down any previous session (shouldn't normally happen, but be safe)
    if (activeRecorder) {
      activeRecorder.abort();
      activeRecorder = null;
    }
    set({
      liveTranscript: '',
      liveInterim: '',
      recordingStatusDetail: null,
    });

    const recorder = new DeepgramRecorder({
      onTranscript: ({ finalText, interimText }) => {
        set({ liveTranscript: finalText, liveInterim: interimText });
      },
      onStatusChange: (status, detail) => {
        // Map Deepgram statuses to the existing session.status field so the
        // UI's existing recording/paused/completed checks keep working.
        const current = get().session;
        if (status === 'recording') {
          set({
            session: { ...current, status: 'recording' },
            recordingStatusDetail: null,
          });
        } else if (status === 'paused') {
          set({ session: { ...current, status: 'paused' } });
        } else if (status === 'stopping' || status === 'stopped') {
          set({ session: { ...current, status: 'completed' } });
        } else if (status === 'connecting') {
          set({ recordingStatusDetail: 'Connecting to transcription...' });
        } else if (status === 'error') {
          set({ recordingStatusDetail: detail || 'Transcription error' });
        }
      },
      onError: (err) => {
        console.error('[deepgram-recorder]', err);
        set({ recordingStatusDetail: err.message });
      },
    });
    activeRecorder = recorder;

    try {
      await recorder.start();
      set({
        session: {
          id: Date.now().toString(),
          status: 'recording',
          startTime: new Date(),
          duration: 0,
        },
        recordingStartedAt: Date.now(),
        pausedAt: null,
        pausedTotalMs: 0,
      });
    } catch (error) {
      activeRecorder = null;
      console.error('Failed to start recording:', error);
      throw error;
    }
  },

  stopRecording: async (): Promise<string> => {
    const recorder = activeRecorder;
    if (!recorder) return '';
    try {
      const transcript = await recorder.stop();
      set({
        session: { ...get().session, status: 'completed' },
        liveTranscript: transcript,
        liveInterim: '',
      });
      return transcript;
    } finally {
      activeRecorder = null;
    }
  },

  pauseRecording: () => {
    activeRecorder?.pause();
    // Anchor the pause so paused time is excluded from the computed duration.
    if (get().pausedAt == null) {
      set({ pausedAt: Date.now() });
    }
  },

  resumeRecording: () => {
    activeRecorder?.resume();
    const pausedAt = get().pausedAt;
    if (pausedAt != null) {
      set({
        pausedTotalMs: get().pausedTotalMs + (Date.now() - pausedAt),
        pausedAt: null,
      });
    }
  },

  resetRecording: () => {
    if (activeRecorder) {
      activeRecorder.abort();
      activeRecorder = null;
    }
    set({
      session: { id: '', status: 'idle', duration: 0 },
      liveTranscript: '',
      liveInterim: '',
      recordingStatusDetail: null,
      recordingStartedAt: null,
      pausedAt: null,
      pausedTotalMs: 0,
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
