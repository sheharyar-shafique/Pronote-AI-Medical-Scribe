// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token management
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

// API Error class
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: { field: string; message: string }[];

  constructor(message: string, status: number, code?: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Base fetch function
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'An error occurred' }));
    throw new ApiError(error.error || 'An error occurred', response.status, error.code, error.details);
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiFetch<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(response.token);
    return response;
  },

  signup: async (email: string, password: string, name: string, specialty: string) => {
    const response = await apiFetch<{ user: User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, specialty }),
    });
    setAuthToken(response.token);
    return response;
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },

  me: async () => {
    return apiFetch<User>('/auth/me');
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiFetch<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  refresh: async () => {
    const response = await apiFetch<{ token: string }>('/auth/refresh', {
      method: 'POST',
    });
    setAuthToken(response.token);
    return response;
  },

  forgotPassword: async (email: string) => {
    return apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyOtp: async (email: string, otp: string) => {
    return apiFetch<{ message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    return apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  },

  // ── 2FA ──────────────────────────────────────────────────────────────────
  enable2fa: async () => {
    return apiFetch<{ message: string }>('/auth/enable-2fa', { method: 'POST' });
  },

  verify2faSetup: async (otp: string) => {
    return apiFetch<{ message: string }>('/auth/verify-2fa-setup', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  },

  disable2fa: async (otp?: string) => {
    return apiFetch<{ message: string }>('/auth/disable-2fa', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  },

  verify2faLogin: async (challengeToken: string, otp: string) => {
    return apiFetch<{ user: User; token: string }>('/auth/verify-2fa-login', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, otp }),
    });
  },

  googleLogin: async (idToken: string) => {
    const response = await apiFetch<{ user: User; token: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    setAuthToken(response.token);
    return response;
  },
};

// Users API
export const usersApi = {
  getProfile: async () => {
    return apiFetch<User>('/users/profile');
  },

  updateProfile: async (data: Partial<User>) => {
    return apiFetch<User>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getSettings: async () => {
    return apiFetch<UserSettings>('/users/settings');
  },

  updateSettings: async (data: Partial<UserSettings>) => {
    return apiFetch<UserSettings>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getStats: async () => {
    return apiFetch<DashboardStats>('/users/stats');
  },

  deleteAccount: async () => {
    return apiFetch<{ message: string }>('/users/account', {
      method: 'DELETE',
    });
  },
};

// Notes API
export const notesApi = {
  getAll: async (params?: NotesQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.template) searchParams.set('template', params.template);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    return apiFetch<NotesResponse>(`/notes${query ? `?${query}` : ''}`);
  },

  getRecent: async (limit = 5) => {
    return apiFetch<RecentNote[]>(`/notes/recent?limit=${limit}`);
  },

  getById: async (id: string) => {
    return apiFetch<ClinicalNote>(`/notes/${id}`);
  },

  create: async (data: CreateNoteData) => {
    return apiFetch<ClinicalNote>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<CreateNoteData>) => {
    return apiFetch<ClinicalNote>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return apiFetch<{ message: string }>(`/notes/${id}`, {
      method: 'DELETE',
    });
  },

  sign: async (id: string) => {
    return apiFetch<{ message: string; status: string }>(`/notes/${id}/sign`, {
      method: 'POST',
    });
  },
};

// Templates API
export const templatesApi = {
  getAll: async () => {
    return apiFetch<Template[]>('/templates');
  },

  getById: async (id: string) => {
    return apiFetch<Template>(`/templates/${id}`);
  },

  create: async (data: CreateTemplateData) => {
    return apiFetch<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<CreateTemplateData>) => {
    return apiFetch<Template>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return apiFetch<{ message: string }>(`/templates/${id}`, {
      method: 'DELETE',
    });
  },

  /** Fetch the user's My Templates selections from the server (cross-device) */
  getPreferences: async () => {
    return apiFetch<{
      preferences: { addedIds: string[]; customTemplates: CustomTemplate[] } | null;
    }>('/templates/preferences');
  },

  /** Persist the user's My Templates selections to the server */
  savePreferences: async (addedIds: string[], customTemplates: CustomTemplate[]) => {
    return apiFetch<{ message: string }>('/templates/preferences', {
      method: 'PUT',
      body: JSON.stringify({ addedIds, customTemplates }),
    });
  },
};

// Teams API
export const teamsApi = {
  get: async () => {
    return apiFetch<Team | null>('/teams');
  },

  create: async (name: string) => {
    return apiFetch<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  rename: async (id: string, name: string) => {
    return apiFetch<{ id: string; name: string }>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  invite: async (teamId: string, email: string) => {
    return apiFetch<TeamMember>(`/teams/${teamId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  accept: async (token: string) => {
    return apiFetch<{ message: string; teamId: string }>('/teams/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  removeMember: async (teamId: string, memberId: string) => {
    return apiFetch<{ message: string }>(`/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  disband: async (teamId: string) => {
    return apiFetch<{ message: string }>(`/teams/${teamId}`, {
      method: 'DELETE',
    });
  },
};

// Audio API
export const audioApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('audio', file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/audio/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new ApiError(error.error, response.status);
    }

    return response.json() as Promise<AudioFile>;
  },

  transcribe: async (audioFileId: string) => {
    return apiFetch<TranscriptionResult>('/audio/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioFileId }),
    });
  },

  generateNote: async (
    transcription: string,
    template: string,
    patientName?: string,
    sectionSettings?: Array<{ title: string; verbosity: string; styling: string; content: string; stylingInstructions: string }>
  ) => {
    return apiFetch<{ content: NoteContent; template: string; source: 'ai' | 'mock' }>('/audio/generate-note', {
      method: 'POST',
      body: JSON.stringify({ transcription, template, patientName, sectionSettings }),
    });
  },

  getFiles: async () => {
    return apiFetch<AudioFile[]>('/audio/files');
  },

  deleteFile: async (id: string) => {
    return apiFetch<{ message: string }>(`/audio/files/${id}`, {
      method: 'DELETE',
    });
  },
};

// Subscriptions API
export const subscriptionsApi = {
  get: async () => {
    return apiFetch<SubscriptionInfo>('/subscriptions');
  },

  getPlans: async () => {
    return apiFetch<PricingPlan[]>('/subscriptions/plans');
  },

  createCheckout: async (plan: string, successUrl: string, cancelUrl: string) => {
    return apiFetch<{ sessionId: string; url: string }>('/subscriptions/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, successUrl, cancelUrl }),
    });
  },

  createPortal: async (returnUrl: string) => {
    return apiFetch<{ url: string }>('/subscriptions/create-portal', {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    });
  },

  cancel: async () => {
    return apiFetch<{ message: string }>('/subscriptions/cancel', {
      method: 'POST',
    });
  },

  reactivate: async () => {
    return apiFetch<{ message: string }>('/subscriptions/reactivate', {
      method: 'POST',
    });
  },

  createPayPalCheckout: async (plan: string, successUrl: string, cancelUrl: string) => {
    return apiFetch<{ subscriptionId: string; url: string }>('/subscriptions/create-paypal-checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, successUrl, cancelUrl }),
    });
  },

  verifyPayPalSubscription: async (subscriptionId: string) => {
    return apiFetch<{ success: boolean; message: string; plan: string }>('/subscriptions/verify-paypal', {
      method: 'POST',
      body: JSON.stringify({ subscriptionId }),
    });
  },
};

// Dashboard API
export interface DashboardStats {
  totalNotes: number;
  notesThisWeek: number;
  notesThisMonth: number;
  averageTime: string;
  accuracy: string;
  completedNotes: number;
  draftNotes: number;
}

export interface Appointment {
  id: string;
  time: string;
  patient: string;
  type: string;
  status: string;
  durationMinutes: number;
}

export interface AnalyticsData {
  period: number;
  total: number;
  dailyAvg: number;
  trend: number;
  notesOverTime: { date: string; count: number }[];
  notesByTemplate: { name: string; value: number }[];
  notesByStatus: { name: string; value: number }[];
  byDayOfWeek: { day: string; count: number }[];
}

export const dashboardApi = {
  getStats: async () => {
    return apiFetch<DashboardStats>('/dashboard/stats');
  },

  getAppointments: async () => {
    return apiFetch<Appointment[]>('/dashboard/appointments');
  },

  createAppointment: async (data: {
    patientName: string;
    patientId?: string;
    appointmentTime: string;
    appointmentType?: string;
    durationMinutes?: number;
    notes?: string;
  }) => {
    return apiFetch<Appointment>('/dashboard/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteAppointment: async (id: string) => {
    return apiFetch<{ message: string }>(`/dashboard/appointments/${id}`, {
      method: 'DELETE',
    });
  },

  getAnalytics: async (days: 7 | 30 | 90 = 30) => {
    return apiFetch<AnalyticsData>(`/dashboard/analytics?days=${days}`);
  },
};

// Admin API
export const adminApi = {
  getStats: async () => {
    return apiFetch<AdminStats>('/admin/stats');
  },

  getUsers: async (params?: AdminUsersParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.role) searchParams.set('role', params.role);

    const query = searchParams.toString();
    return apiFetch<AdminUsersResponse>(`/admin/users${query ? `?${query}` : ''}`);
  },

  getUser: async (id: string) => {
    return apiFetch<AdminUserDetail>(`/admin/users/${id}`);
  },

  createUser: async (data: CreateAdminUserData) => {
    return apiFetch<{ id: string; email: string; name: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateUser: async (id: string, data: Partial<CreateAdminUserData>) => {
    return apiFetch<AdminUserDetail>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateUserStatus: async (id: string, status: 'active' | 'inactive' | 'suspended') => {
    return apiFetch<{ message: string; status: string }>(`/admin/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  deleteUser: async (id: string) => {
    return apiFetch<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  },

  getActivity: async (params?: ActivityParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.action) searchParams.set('action', params.action);

    const query = searchParams.toString();
    return apiFetch<ActivityResponse>(`/admin/activity${query ? `?${query}` : ''}`);
  },
};

// Type definitions
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'clinician' | 'admin';
  specialty: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial';
  subscriptionPlan: 'individual_annual' | 'group_monthly' | 'group_annual' | null;
  trialEndsAt: string | null;
  createdAt: string;
  avatar?: string;
}

export interface UserSettings {
  defaultTemplate: string;
  autoSave: boolean;
  darkMode: boolean;
  notificationsEnabled: boolean;
  audioQuality: string;
  language: string;
}

export interface DashboardStats {
  totalNotes: number;
  notesThisWeek: number;
  averageTime: string;
  accuracy: string;
}

export interface NoteContent {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  reviewOfSystems?: string;
  physicalExam?: string;
  medicalDecisionMaking?: string;
  instructions?: string;
  followUp?: string;
  customSections?: Record<string, string>;
}

export interface ClinicalNote {
  id: string;
  userId: string;
  patientName: string;
  patientId?: string;
  dateOfService: string;
  template: string;
  status: 'draft' | 'completed' | 'signed';
  audioUrl?: string;
  transcription?: string;
  content: NoteContent;
  createdAt: string;
  updatedAt: string;
}

export interface RecentNote {
  id: string;
  patientName: string;
  dateOfService: string;
  template: string;
  status: string;
  createdAt: string;
}

export interface NotesQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  template?: string;
  search?: string;
}

export interface NotesResponse {
  notes: ClinicalNote[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateNoteData {
  patientName: string;
  patientId?: string;
  dateOfService?: string;
  template: string;
  content?: NoteContent;
  status?: 'draft' | 'completed' | 'signed';
  transcription?: string;
  // Recording length in seconds; backend persists this in processing_time_seconds
  // and echoes it back as ClinicalNote.durationSeconds.
  processingTime?: number;
}

export interface Template {
  id: string;
  dbId?: string;
  name: string;
  description: string;
  sections: string[];
  specialty: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  templateType: string;
  sections: string[];
  specialty?: string;
}

/** Mirrors the shape stored in pronote_custom_templates / template_preferences */
export interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  specialty: string;
  sections: {
    id: string;
    name: string;
    verbosity: string;
    format: string;
    included: boolean;
  }[];
  isCustom?: boolean;
}

export interface TeamMember {
  id: string;
  userId: string | null;
  role: 'owner' | 'member';
  status: 'active' | 'pending';
  invitedEmail: string;
  joinedAt: string | null;
  name: string | null;
  email: string;
  specialty: string | null;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  memberLimit: number;
  plan: string;
  isOwner: boolean;
  members: TeamMember[];
}

export interface AudioFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  url?: string;
  duration?: number;
  status: string;
  createdAt?: string;
}

export interface TranscriptionResult {
  audioFileId: string;
  transcription: string;
  status: string;
}

export interface SubscriptionInfo {
  status: string;
  plan: string | null;
  trialEndsAt: string | null;
  subscription: {
    id: string;
    stripeSubscriptionId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number | null;
  period: string;
  originalPrice?: number;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalNotes: number;
  notesThisMonth: number;
  usersByPlan: Record<string, number>;
}

export interface AdminUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  specialty: string;
  status: string;
  plan: string;
  notesCount: number;
  createdAt: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminUserDetail extends AdminUser {
  subscriptionStatus: string;
  subscriptionPlan: string;
  trialEndsAt: string | null;
  subscription: unknown | null;
}

export interface CreateAdminUserData {
  email: string;
  password: string;
  name: string;
  role?: string;
  specialty?: string;
  subscriptionPlan?: string;
}

export interface ActivityParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityResponse {
  logs: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
