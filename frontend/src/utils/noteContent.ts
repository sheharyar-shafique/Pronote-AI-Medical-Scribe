/**
 * Sanitize GPT note content before saving to the notes API.
 *
 * The notes API validates every section with z.string(), but the model output
 * isn't always that clean:
 *   - null/undefined values → coerce to '' so the section still renders in the
 *     editor (dropping the key would make the body blank)
 *   - arrays (GPT sometimes returns bullet sections as ["• a", "• b"]) → join
 *     into one newline-separated string of "• " lines
 *   - nested objects (subsection maps) → flatten to "Label: value" lines;
 *     customSections is kept as an object since the API allows it
 *
 * The backend also normalizes this server-side; this is defense in depth so a
 * stale backend can't surface "Expected string, received array" to the user.
 */
export function sanitizeNoteContent(
  content: unknown
): Record<string, unknown> {
  const toText = (v: unknown): string =>
    typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);

  const sanitized: Record<string, unknown> = {};
  if (!content || typeof content !== 'object') return sanitized;

  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value
        .map((item) => {
          const s = toText(item).trim();
          return s.startsWith('•') || s.startsWith('-') ? s : `• ${s}`;
        })
        .filter(Boolean)
        .join('\n');
    } else if (value != null && typeof value === 'object') {
      if (key === 'customSections') {
        sanitized[key] = Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, toText(v)])
        );
      } else {
        sanitized[key] = Object.entries(value)
          .map(([label, v]) => `${label}: ${toText(v).trim()}`)
          .join('\n');
      }
    } else {
      sanitized[key] = '';
    }
  }
  return sanitized;
}
