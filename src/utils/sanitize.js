//  sanitize.js  Input sanitization 
// Strips XSS vectors and injection attempts from any string before it is
// written to Firebase, localStorage, or rendered as HTML.

const _DANGEROUS = /<\s*script[\s\S]*?>[\s\S]*?<\/script>/gi;
const _HTML_TAGS = /<[^>]+>/g;
const _NULL_BYTE = /\x00/g;

/**
 * Sanitize a single string value.
 * - Removes script tags and their content
 * - Strips all HTML tags
 * - Removes null bytes
 * - Trims and enforces a max length (default 4000 chars)
 */
export function sanitizeString(value, maxLength = 4000) {
  if (typeof value !== 'string') return value;
  let s = value;
  s = s.replace(_DANGEROUS, '');
  s = s.replace(_HTML_TAGS,  '');
  s = s.replace(_NULL_BYTE,  '');
  s = s.trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/**
 * Recursively sanitize all string values in an object or array.
 * Non-string primitives and dates pass through unchanged.
 */
export function sanitizePayload(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = sanitizePayload(v);
  }
  return out;
}
