import type { SectionSetting } from '../types';

// ──────────────────────────────────────────────────────────────────────────────
// Shared per-section defaults.
//
// These are the SINGLE SOURCE OF TRUTH for how a section should be styled when
// the user hasn't explicitly customized it. Both the Template Editor (where the
// user can override them) and the capture/dictation/upload flows (where we
// synthesize settings for built-in templates that carry none) import from here.
//
// Why this exists: built-in templates have no `sectionSettings`, so before this
// the bullet/paragraph + concise/detailed preferences never reached the AI for
// them — every built-in note came back as detailed prose. Synthesizing defaults
// here lets us send the styling intent for built-ins too.
// ──────────────────────────────────────────────────────────────────────────────

// Default content hints for common SOAP-style sections.
export const DEFAULT_CONTENT: Record<string, string> = {
  Subjective: "The patient's reported symptoms and medical history.",
  Objective:
    'Any observable and measurable findings about the patient from the conversation.\n\nInclude the following subsections if relevant:\nVital Signs\nPhysical Exam Results\nDiagnostic Test Results and Labs',
  Assessment:
    'Combine subjective and objective data to list detailed diagnoses.\nFor each diagnosis - begin with the diagnosis title, followed by its assessment.',
  Plan: 'For each diagnosis listed in the assessment, provide a detailed plan.',
  'Chief Complaint': 'The primary reason the patient is seeking care today.',
  HPI: "A detailed narrative of the patient's present illness.",
  'Review of Systems': 'Systematic review of body systems relevant to the chief complaint.',
  'Physical Exam': 'Documented findings from the physical examination.',
  'Medical Decision Making': 'Clinical reasoning supporting the diagnosis and treatment plan.',
  'Follow-Up': 'Instructions for follow-up care and next steps.',
  'Patient Instructions':
    'Compose a detailed and well-structured formal email from the doctor to the patient, summarizing the consultation and providing comprehensive care and treatment instructions.',
};

// Sections that default to paragraph styling (everything else defaults to bullet).
export const DEFAULT_STYLING: Record<string, 'paragraph' | 'bullet'> = {
  Subjective: 'paragraph',
  'Chief Complaint': 'paragraph',
  HPI: 'paragraph',
  'Medical Decision Making': 'paragraph',
};

/** The default styling/verbosity for a single section title. */
export function defaultSectionSetting(title: string): SectionSetting {
  return {
    title,
    verbosity: 'detailed',
    styling: DEFAULT_STYLING[title] ?? 'bullet',
    content: DEFAULT_CONTENT[title] ?? '',
    stylingInstructions: '',
  };
}

/**
 * Synthesize a full SectionSetting[] from a template's section titles, using the
 * shared defaults above. Used for built-in templates that don't carry their own
 * sectionSettings so their styling preferences still reach the AI.
 */
export function buildDefaultSectionSettings(sections: string[] | undefined): SectionSetting[] {
  if (!sections || sections.length === 0) return [];
  return sections.map(defaultSectionSetting);
}
