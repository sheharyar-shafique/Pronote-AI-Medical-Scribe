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
  // GPT-generated short clinical title (4-8 words). May arrive as a top-level field
  // straight from the model, or be tucked into customSections.topic by the backend.
  topic?: string;
  customSections?: Record<string, string>;
}

export type NoteTemplate =
  // General / Core
  | 'soap'
  | 'progress-notes'
  | 'daily-note'
  | 'hpi'
  | 'chart-notes'
  | 'chronic-care-management'
  | 'wellness-plan'
  // Psychiatry & Mental Health
  | 'psychiatry'
  | 'psych-eval'
  | 'psychiatric-soap'
  | 'mental-health-progress-note'
  | 'mental-health-intake'
  | 'mental-health-risk-assessment'
  | 'biopsychosocial-assessment'
  | 'behavioral-health-progress-note'
  // Therapy
  | 'therapy'
  | 'girp-note'
  | 'dbt-diary-card'
  | 'family-therapy-note'
  | 'couples-therapy-note'
  // Physical & Occupational Therapy
  | 'physical-therapy-eval'
  | 'occupational-therapy'
  | 'speech-therapy'
  // Nursing
  | 'nursing-notes'
  | 'nursing-report-sheet'
  // Specialty
  | 'pediatrics'
  | 'cardiology'
  | 'dermatology'
  | 'orthopedics'
  | 'adime-note'
  // Administrative / Forms
  | 'patient-referral-form'
  | 'telehealth-consent'
  | 'esa-letter'
  | 'medical-certificate'
  | 'insurance-claim'
  // Custom
  | 'custom'
  | (string & Record<never, never>); // allow custom-<timestamp> IDs

export interface SectionSetting {
  title: string;
  verbosity: 'concise' | 'detailed';
  styling: 'paragraph' | 'bullet';
  content: string;          // content description / hint for the AI
  stylingInstructions: string; // extra custom formatting instructions
}

export interface Template {
  id: NoteTemplate;
  name: string;
  description: string;
  sections: string[];
  sectionSettings?: SectionSetting[];  // present on custom templates
  specialty: string;
  isCustom?: boolean;
  isDefault?: boolean;
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
