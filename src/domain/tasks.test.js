import { describe, it, expect } from 'vitest';
import { normalizeTask, normalizeTasks, makeTask, normalizePriority } from './tasks.js';

describe('normalizeTask', () => {
  it('reads a legacy assistant-created task ({title, completed, medium})', () => {
    const t = normalizeTask({ id: 'a', title: 'Call dentist', completed: false, priority: 'medium' });
    expect(t).toMatchObject({ id: 'a', text: 'Call dentist', done: false, priority: 'med' });
    expect(t.title).toBe('Call dentist'); // original fields preserved
  });

  it('reads a completed legacy task as done', () => {
    expect(normalizeTask({ title: 'x', completed: true }).done).toBe(true);
  });

  it('leaves a canonical UI task unchanged in meaning', () => {
    const t = normalizeTask({ text: 'Run', done: true, priority: 'low', tag: 'Health' });
    expect(t).toMatchObject({ text: 'Run', done: true, priority: 'low', tag: 'Health' });
  });

  it('prefers the explicit `done` flag once a legacy task has been toggled in the UI', () => {
    expect(normalizeTask({ title: 'x', completed: false, done: true }).done).toBe(true);
  });

  it('prefers non-empty text over title', () => {
    expect(normalizeTask({ text: 'new', title: 'old' }).text).toBe('new');
    expect(normalizeTask({ text: '  ', title: 'old' }).text).toBe('old');
  });

  it('tolerates garbage', () => {
    expect(normalizeTasks(null)).toEqual([]);
    expect(normalizeTask(null)).toBeNull();
    expect(normalizeTask({}).text).toBe('');
  });
});

describe('makeTask', () => {
  it('produces the canonical shape the UI reads', () => {
    const t = makeTask({ text: '  Book flights ', priority: 'medium' });
    expect(t).toMatchObject({ text: 'Book flights', done: false, priority: 'med' });
    expect(t).not.toHaveProperty('title');
    expect(t).not.toHaveProperty('completed');
  });
});

describe('normalizePriority', () => {
  it('maps aliases and defaults unknown values to med', () => {
    expect(normalizePriority('high')).toBe('high');
    expect(normalizePriority('urgent')).toBe('high');
    expect(normalizePriority(undefined)).toBe('med');
  });
});
