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

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
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
    throw new ApiError(error.error || 'An error occurred', response.status, error.code);
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

  generateNote: async (transcription: string, template: string, patientName?: string) => {
    return apiFetch<{ content: NoteContent; template: string }>('/audio/generate-note', {
      method: 'POST',
      body: JSON.stringify({ transcription, template, patientName }),
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
