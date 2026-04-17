import { z } from 'zod';

// User schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  specialty: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  specialty: z.string().optional(),
  avatar: z.string().url().optional(),
});

// Note schemas
export const createNoteSchema = z.object({
  patientName: z.string().min(1, 'Patient name is required'),
  patientId: z.string().optional(),
  dateOfService: z.string().optional(),
  template: z.enum(['soap', 'psychiatry', 'therapy', 'pediatrics', 'cardiology', 'dermatology', 'orthopedics', 'custom']),
  content: z.object({
    subjective: z.string().optional(),
    objective: z.string().optional(),
    assessment: z.string().optional(),
    plan: z.string().optional(),
    chiefComplaint: z.string().optional(),
    historyOfPresentIllness: z.string().optional(),
    reviewOfSystems: z.string().optional(),
    physicalExam: z.string().optional(),
    medicalDecisionMaking: z.string().optional(),
    instructions: z.string().optional(),
    followUp: z.string().optional(),
    customSections: z.record(z.string()).optional(),
  }).optional(),
  status: z.enum(['draft', 'completed', 'signed']).optional(),
  transcription: z.string().optional(),
  processingTime: z.number().optional(),
});

export const updateNoteSchema = createNoteSchema.partial();

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  templateType: z.string(),
  sections: z.array(z.string()),
  specialty: z.string().optional(),
});

// Settings schema
export const updateSettingsSchema = z.object({
  defaultTemplate: z.enum(['soap', 'psychiatry', 'therapy', 'pediatrics', 'cardiology', 'dermatology', 'orthopedics', 'custom']).optional(),
  autoSave: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  audioQuality: z.enum(['low', 'medium', 'high']).optional(),
  language: z.string().optional(),
});

// Subscription schema
export const createCheckoutSchema = z.object({
  plan: z.enum(['individual_annual', 'group_monthly', 'group_annual']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
