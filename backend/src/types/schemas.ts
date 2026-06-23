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

// Helper: accept string, null, or undefined — coerce null → undefined
const nullableString = z.string().nullable().optional().transform(v => v ?? undefined);

// Note schemas
export const createNoteSchema = z.object({
  patientName: z.string().min(1, 'Patient name is required'),
  patientId: z.string().nullable().optional(),
  dateOfService: z.string().nullable().optional(),
  template: z.string().min(1, 'Template is required'),
  content: z.object({
    subjective: nullableString,
    objective: nullableString,
    assessment: nullableString,
    plan: nullableString,
    chiefComplaint: nullableString,
    historyOfPresentIllness: nullableString,
    reviewOfSystems: nullableString,
    physicalExam: nullableString,
    medicalDecisionMaking: nullableString,
    instructions: nullableString,
    followUp: nullableString,
    customSections: z.record(z.string()).nullable().optional(),
  }).passthrough().optional(),
  status: z.enum(['draft', 'completed', 'signed']).optional(),
  transcription: z.string().nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  processingTime: z.number().nullable().optional(),
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
  defaultTemplate: z.string().optional(),
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
