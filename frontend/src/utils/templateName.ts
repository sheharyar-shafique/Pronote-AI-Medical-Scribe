import { templates as builtInTemplates } from '../data';
import type { Template } from '../types';

// Resolve a stored template ID to a human-readable name for display.
//
// Notes persist `template` as an ID, not a name. Built-in IDs are readable-ish
// ('soap'), but custom templates are saved as `custom-<timestamp>`, which leaked
// into the UI as e.g. "Custom-1778611029033". This maps the ID back to the
// template's real name: built-ins from the bundled list, custom templates from
// the user's saved list (localStorage, synced from the server). Falls back to a
// clean label when the custom template definition isn't available locally.
export function templateDisplayName(templateId: string | undefined | null): string {
  if (!templateId) return 'Note';

  const builtIn = builtInTemplates.find((t) => t.id === templateId);
  if (builtIn?.name) return builtIn.name;

  try {
    const customs: Template[] = JSON.parse(
      localStorage.getItem('pronote_custom_templates') || '[]'
    );
    const custom = customs.find((t) => t.id === templateId);
    if (custom?.name) return custom.name;
  } catch {
    // localStorage unavailable / malformed — fall through to a clean label.
  }

  // Custom template whose definition isn't on this device — don't show the raw
  // `custom-1778611029033` ID.
  if (/^custom-/i.test(templateId)) return 'Custom Template';

  // Plain built-in-style id we don't recognize: 'progress-notes' -> 'Progress Notes'.
  return templateId
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
