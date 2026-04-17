// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'clinician' | 'admin';
  specialty: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial';
  subscriptionPlan: 'individual_annual' | 'group_monthly' | 'group_annual' | null;
  trialEndsAt: Date | null;
  createdAt: Date;
  avatar?: string;
}

// Note types
export interface ClinicalNote {
  id: string;
  userId: string;
  patientName: string;
  patientId?: string;
  dateOfService: Date;
  template: NoteTemplate;
  content: NoteContent;
  status: 'draft' | 'completed' | 'signed';
  audioUrl?: string;
  transcription?: string;
  createdAt: Date;
  updatedAt: Date;
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

export type NoteTemplate = 
  | 'soap'
  | 'psychiatry'
  | 'therapy'
  | 'pediatrics'
  | 'cardiology'
  | 'dermatology'
  | 'orthopedics'
  | 'custom';

export interface Template {
  id: NoteTemplate;
  name: string;
  description: string;
  sections: string[];
  specialty: string;
}

// Recording types
export interface RecordingSession {
  id: string;
  status: 'idle' | 'recording' | 'paused' | 'processing' | 'completed';
  startTime?: Date;
  duration: number;
  audioBlob?: Blob;
}

// Subscription types
export interface Subscription {
  id: string;
  userId: string;
  plan: 'individual_annual' | 'group_monthly' | 'group_annual';
  status: 'active' | 'inactive' | 'canceled' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

// Stats types
export interface DashboardStats {
  totalNotes: number;
  notesThisWeek: number;
  averageTime: string;
  accuracy: string;
}

// FAQ types
export interface FAQ {
  id: string;
  question: string;
  answer: string;
}
