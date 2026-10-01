import { describe, it, expect } from 'vitest';
import { standardOfDay, moodStrip, journalFor, readJournal, journalHasContent, journalRow, journalStreak, decisionsToRevisit, listsGlance, journalTitle } from './mindToday.js';

const TODAY = '2026-10-01';
const key = (off) => new Date(Date.parse(TODAY) - off * 86400000).toISOString().slice(0, 10);

describe('standardOfDay', () => {
  const c = { nonNegotiables: '1. Never skip sleep\n2. No lying', rules: '- Train before noon', principles: '', values: 'Integrity\nx' };
  it('picks one line from your own words, the same all day and a different one tomorrow', () => {
    const a = standardOfDay(c, TODAY), b = standardOfDay(c, TODAY), next = standardOfDay(c, '2026-10-02');
    expect(a).toEqual(b);
    expect(a.text).not.toMatch(/^\d|^-/);
    expect(next.text).not.toBe(a.text);
  });
  it('pools non-negotiables first, ignores lines under 3 characters, and is null when empty', () => {
    const pool = new Set(Array.from({ length: 12 }, (_, i) => standardOfDay(c, key(-i)).text));
    expect([...pool].sort()).toEqual(['Integrity', 'No lying', 'Never skip sleep', 'Train before noon'].sort());
    expect(standardOfDay({}, TODAY)).toBeNull();
    expect(standardOfDay(null, TODAY)).toBeNull();
    expect(standardOfDay(c, 'bad')).toBeNull();
  });
});

describe('moodStrip', () => {
  it('gives 14 days with gaps as null, today, the 7-day average and the change on the week before', () => {
    const logs = [{ date: key(0), mood: 5 }, { date: key(1), mood: 3 }, { date: key(8), mood: 2 }, { date: key(9), mood: 2 }, { date: 'bad', mood: 4 }, { date: key(2), mood: 99 }];
    const s = moodStrip(logs, TODAY);
    expect(s.strip).toHaveLength(14);
    expect(s.strip[13]).toEqual({ date: TODAY, mood: 5 });
    expect(s.strip[11].mood).toBeNull();
    expect(s).toMatchObject({ today: 5, avg7: 4, change: 2, logged: 4 });
  });
  it('has no change without both weeks', () => {
    expect(moodStrip([{ date: key(0), mood: 4 }], TODAY).change).toBeNull();
    expect(moodStrip([], 'bad')).toBeNull();
  });
});

describe('journal', () => {
  const j = { intention: ' Ship the thing ', gratitude: ['Sun', '', ' Coffee'], reflection: ' Good day ' };
  it('builds a note row with a readable body and clean fields', () => {
    const row = journalRow(TODAY, j);
    expect(row).toMatchObject({ journal: true, date: TODAY, intention: 'Ship the thing', gratitude: ['Sun', 'Coffee'], reflection: 'Good day' });
    expect(row.body).toBe('Intention: Ship the thing\n\nGrateful for:\n- Sun\n- Coffee\n\nReflection: Good day');
    expect(row.title).toBe(journalTitle(TODAY));
  });
  it('round-trips through readJournal and finds the right day', () => {
    const note = { id: 'n1', ...journalRow(TODAY, j) };
    expect(readJournal(note)).toEqual({ intention: 'Ship the thing', gratitude: ['Sun', 'Coffee', ''], reflection: 'Good day' });
    expect(journalFor([{ journal: false, date: TODAY }, note], TODAY).id).toBe('n1');
    expect(journalFor([note], '2026-09-01')).toBeNull();
    expect(readJournal(null)).toEqual({ intention: '', gratitude: ['', '', ''], reflection: '' });
  });
  it('knows when there is nothing to save', () => {
    expect(journalHasContent({ intention: ' ', gratitude: ['', '', ''], reflection: '' })).toBe(false);
    expect(journalHasContent({ intention: '', gratitude: ['', 'x', ''], reflection: '' })).toBe(true);
  });
  it('counts a streak that ends yesterday while today is open, and keeps the best', () => {
    const mk = (off) => ({ journal: true, date: key(off), body: 'x' });
    const notes = [mk(1), mk(2), mk(3), mk(10), mk(11), mk(12), mk(13), mk(14), { journal: true, date: key(5), body: '' }];
    expect(journalStreak(notes, TODAY)).toEqual({ current: 3, best: 5, today: false });
    expect(journalStreak([mk(0), ...notes], TODAY)).toMatchObject({ current: 4, today: true });
    expect(journalStreak([], TODAY)).toEqual({ current: 0, best: 0, today: false });
  });
});

describe('decisionsToRevisit', () => {
  const dec = (o) => ({ id: o.title, ...o });
  it('lists decisions whose review date has come or that are a month old, without an outcome, oldest first', () => {
    const list = decisionsToRevisit([
      dec({ title: 'Quit job', date: key(40) }), dec({ title: 'Buy car', date: key(5), reviewDate: key(1) }), dec({ title: 'Future', date: key(5), reviewDate: key(-9) }),
      dec({ title: 'Settled', date: key(60), actualOutcome: 'Worked' }), dec({ title: 'Recent', date: key(3) }), dec({ title: '', date: key(50) }),
    ], TODAY);
    expect(list.map(d => d.title)).toEqual(['Quit job', 'Buy car']);
    expect(list[0].daysAgo).toBe(40);
  });
});

describe('listsGlance', () => {
  it('shows what is in progress and how many are queued', () => {
    const g = listsGlance([{ title: 'A', status: 'in_progress' }, { title: 'B', status: 'up_next' }, { title: 'C', status: 'done' }, { status: 'in_progress' }]);
    expect(g.inProgress.map(i => i.title)).toEqual(['A']);
    expect(g).toMatchObject({ upNext: 1, total: 4 });
  });
});
