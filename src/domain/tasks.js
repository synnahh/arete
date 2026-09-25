// tasks.js — one canonical task shape for every reader and writer.
//
// Canonical: { text, done, priority: 'high' | 'med' | 'low', ... }
// Legacy (written by the assistant before this fix): { title, completed, priority: 'medium' }
//
// Reads normalise both shapes, so existing rows need no migration. Writers use
// makeTask() so new rows are canonical. Unknown fields are always preserved.

const PRIORITY_ALIASES = { medium: 'med', normal: 'med', urgent: 'high' };
const PRIORITIES = new Set(['high', 'med', 'low']);

export function normalizePriority(p) {
  const v = PRIORITY_ALIASES[p] ?? p;
  return PRIORITIES.has(v) ? v : 'med';
}

/** Legacy-tolerant view of a stored task. Never drops fields. */
export function normalizeTask(t) {
  if (!t || typeof t !== 'object') return t;
  const text = typeof t.text === 'string' && t.text.trim() ? t.text
             : typeof t.title === 'string' ? t.title
             : '';
  const done = typeof t.done === 'boolean' ? t.done : Boolean(t.completed);
  return { ...t, text, done, priority: normalizePriority(t.priority) };
}

export const normalizeTasks = (list) => (Array.isArray(list) ? list.map(normalizeTask) : []);

/** Build a new canonical task. */
export function makeTask({ text, priority, description = '', ...rest } = {}) {
  const now = Date.now();
  return {
    ...rest,
    text: String(text ?? '').trim(),
    description,
    priority: normalizePriority(priority),
    done: false,
    createdAt: now,
    updatedAt: now,
  };
}
