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

/** Advance a YYYY-MM-DD date by a repeat cycle using UTC math (no timezone drift). Unknown repeat: unchanged. */
export function advanceByRepeat(iso, repeat, today = null) {
  const base = iso || today;
  const [y, m, d] = String(base || '').split('-').map(Number);
  if (!y || !m || !d) return base;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (repeat === 'daily')        dt.setUTCDate(dt.getUTCDate() + 1);
  else if (repeat === 'weekly')  dt.setUTCDate(dt.getUTCDate() + 7);
  else if (repeat === 'monthly') dt.setUTCMonth(dt.getUTCMonth() + 1);
  else return base;
  return dt.toISOString().split('T')[0];
}

/** The row to add when a repeating task is completed, or null for a one-off. */
export function nextOccurrence(task, today = null) {
  if (!task?.repeat || task.repeat === 'none') return null;
  return {
    text: task.text, description: task.description || '',
    priority: task.priority || 'med',
    dueDate: advanceByRepeat(task.dueDate, task.repeat, today),
    category: task.category || '', repeat: task.repeat, done: false,
  };
}
