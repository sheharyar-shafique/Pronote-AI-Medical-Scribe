// ──────────────────────────────────────────────────────────────────────────────
// Section-title → JSON-key derivation.
//
// MUST stay byte-for-byte identical to the backend's sectionTitleToKey in
// backend/src/routes/audio.ts. buildDynamicPrompt tells GPT to emit one JSON
// field per section using THIS key. Unknown/custom section titles (e.g. "MSN",
// "DSM-5 Diagnoses:", "Risk Assessment") fall to the camelCase derivation and
// are stored by the backend under note_contents.custom_sections[key]. If the
// editor derived a different key, those sections render blank — which is exactly
// the bug this fixes for custom templates.
// ──────────────────────────────────────────────────────────────────────────────

const SECTION_TITLE_TO_KEY: Record<string, string> = {
  Subjective: 'subjective',
  Objective: 'objective',
  Assessment: 'assessment',
  Plan: 'plan',
  'Patient Instructions': 'instructions',
  Instructions: 'instructions',
  'Chief Complaint': 'chiefComplaint',
  'History of Present Illness': 'historyOfPresentIllness',
  HPI: 'historyOfPresentIllness',
  'Review of Systems': 'reviewOfSystems',
  'Physical Exam': 'physicalExam',
  'Mental Status Exam': 'physicalExam',
  'Medical Decision Making': 'medicalDecisionMaking',
  'Follow-Up': 'followUp',
};

export function sectionTitleToKey(title: string): string {
  return (
    SECTION_TITLE_TO_KEY[title] ||
    title.replace(/[^a-zA-Z0-9]/g, '').replace(/^(.)/, (_, c) => c.toLowerCase())
  );
}
