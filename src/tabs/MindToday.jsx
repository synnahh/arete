// MindToday — the Mind group's front page: your own standard for the day, a mood check-in,
// a short daily journal, a breathing reset, quick capture, decisions due a look, and what
// you are reading or watching. Rules: src/domain/mindToday.js. Journal entries are ordinary
// notes, so they also appear in Notes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { addXP } from '../utils/xp.js';
import { MOOD_LABELS, standardOfDay, moodStrip, journalFor, readJournal, journalHasContent, journalRow, journalStreak, decisionsToRevisit, listsGlance } from '../domain/mindToday.js';
import BreathingTool from '../components/BreathingTool.jsx';
import { label } from '../components/ui.js';

const CARD = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
const MOOD_COLOUR = ['#e55a5a', '#e8803a', '#e8a13a', '#c9c24a', '#8fcf5a', '#4caf7d', '#3fc2b0'];
const toast = (detail) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail }));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const area = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 14.5, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none' };
const btn = { height: 38, padding: '0 16px', borderRadius: 9, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const primary = { ...btn, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)', border: 'none' };
const linkBtn = { background: 'none', border: 'none', color: 'var(--tab-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 4, fontFamily: 'inherit' };
const small = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 };

export default function MindToday({ onTabChange, compact = false }) {
  const today = toLocalDateKey(new Date());
  const go = (screen) => onTabChange?.(screen);

  const constitution = useDocument('constitution', 'valerie_constitution', null).data;
  const notes = useCollection('notes', STORAGE_KEYS.NOTES);
  const moods = useCollection('mood_logs', STORAGE_KEYS.MOOD_LOGS);
  const decisions = useCollection('mind_decisions', 'valerie_decisions');
  const lists = useCollection('watch_list', STORAGE_KEYS.LISTS);

  const standard = useMemo(() => standardOfDay(constitution, today), [constitution, today]);
  const strip = useMemo(() => moodStrip(moods.items, today), [moods.items, today]);
  const todayNote = useMemo(() => journalFor(notes.items, today), [notes.items, today]);
  const streak = useMemo(() => journalStreak(notes.items, today), [notes.items, today]);
  const revisit = useMemo(() => decisionsToRevisit(decisions.items, today), [decisions.items, today]);
  const glance = useMemo(() => listsGlance(lists.items), [lists.items]);
  const recent = useMemo(() => [...(notes.items || [])].filter(n => n?.journal !== true).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)).slice(0, 4), [notes.items]);

  // Journal draft: loaded from today's note once it syncs, then edited locally until saved.
  const [draft, setDraft] = useState(() => readJournal(null));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(null);
  useEffect(() => {
    const id = todayNote?.id ?? null;
    if (!dirty && loaded.current !== id) { loaded.current = id; setDraft(readJournal(todayNote)); }
  }, [todayNote, dirty]);
  const edit = (patch) => { setDraft(d => ({ ...d, ...patch })); setDirty(true); };
  const editG = (i, v) => { setDraft(d => ({ ...d, gratitude: d.gratitude.map((x, k) => (k === i ? v : x)) })); setDirty(true); };

  const [capture, setCapture] = useState('');
  const [breathing, setBreathing] = useState(false);
  const [outcome, setOutcome] = useState({});

  async function saveJournal() {
    if (!journalHasContent(draft) || saving) return;
    setSaving(true);
    try {
      const row = journalRow(today, draft);
      const ok = todayNote?.id ? await notes.update(todayNote.id, row) : await notes.add(row);
      if (ok) { setDirty(false); toast({ message: 'Journal saved', type: 'success' }); }
    } finally { setSaving(false); }
  }

  async function logMood(i) {
    const existing = (moods.items || []).find(m => m.date === today);
    const prev = existing ? existing.mood : null;
    const ok = existing ? await moods.update(existing.id, { mood: i }) : await moods.add({ date: today, mood: i, note: null });
    if (!ok) return;
    if (!existing) { try { addXP('MOOD_LOGGED'); } catch { /* XP is a bonus */ } }
    toast({ message: `Mood: ${MOOD_LABELS[i]}`, type: 'success', undo: () => (existing ? moods.update(existing.id, { mood: prev }) : moods.remove(typeof ok === 'string' ? ok : (moods.items || []).find(m => m.date === today)?.id)) });
  }

  async function quickNote() {
    const text = capture.trim();
    if (!text) return;
    const first = text.split(/\r?\n/)[0].slice(0, 60);
    const id = await notes.add({ title: first, body: text, pinned: false, createdAt: Date.now(), updatedAt: Date.now() });
    if (id) { setCapture(''); toast({ message: 'Note saved', type: 'success', undo: () => notes.remove(id) }); }
  }

  async function saveOutcome(d) {
    const text = (outcome[d.id] || '').trim();
    if (!text) return;
    const ok = await decisions.update(d.id, { actualOutcome: text });
    if (ok) setOutcome(o => ({ ...o, [d.id]: '' }));
  }

  const dateText = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Date().getHours();
  const prompt = hour < 12 ? 'Start of the day: set one intention.' : hour < 18 ? 'Midday check: how is it going?' : 'Evening: close the day with a reflection.';

  return (
    <div style={{ padding: compact ? '12px 14px 28px' : '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100%' }}>
      <div>
        <div style={label}>{dateText}</div>
        <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: compact ? 22 : 28, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text-primary)' }}>Mind</h1>
      </div>

      <section aria-label="Your standard" style={{ ...CARD, borderColor: 'color-mix(in srgb, var(--tab-accent) 35%, var(--card-border))' }}>
        <div style={label}>{standard ? `Your standard today · ${standard.source}` : 'Your standard'}</div>
        {standard ? (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 19 : 23, lineHeight: 1.4, color: 'var(--text-primary)' }}>{standard.text}</div>
        ) : (
          <div style={{ ...small, fontSize: 14 }}>Write down your values, rules and non-negotiables once, and one of them is put in front of you each day.</div>
        )}
        <div><button type="button" style={linkBtn} onClick={() => go('mind')}>{standard ? 'Open your constitution' : 'Write your constitution'}</button></div>
      </section>

      <div className="plan-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section aria-label="Mood" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={label}>How are you today?</div>
              {strip?.avg7 != null && <div style={small}>7-day average {MOOD_LABELS[Math.round(strip.avg7)]}{strip.change != null && strip.change !== 0 ? ` · ${strip.change > 0 ? 'up' : 'down'} ${Math.abs(strip.change)} on the week before` : ''}</div>}
            </div>
            <div role="group" aria-label="Mood" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: compact ? 4 : 8 }}>
              {MOOD_LABELS.map((name, i) => {
                const on = strip?.today === i;
                return (
                  <button key={name} type="button" aria-pressed={on} onClick={() => logMood(i)}
                    style={{ padding: '10px 0 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      border: `0.5px solid ${on ? MOOD_COLOUR[i] : 'var(--card-border)'}`, background: on ? `color-mix(in srgb, ${MOOD_COLOUR[i]} 20%, transparent)` : 'transparent', color: 'var(--text-primary)' }}>
                    <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', background: MOOD_COLOUR[i], opacity: on || strip?.today == null ? 1 : 0.45 }} />
                    <span style={{ fontSize: compact ? 10.5 : 12, color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{name}</span>
                  </button>
                );
              })}
            </div>
            {strip && (
              <div role="img" aria-label="Mood over the last 14 days" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34 }}>
                {strip.strip.map(d => <span key={d.date} title={d.mood == null ? d.date : `${d.date}: ${MOOD_LABELS[d.mood]}`} style={{ flex: 1, height: d.mood == null ? 3 : `${22 + (d.mood / 6) * 78}%`, borderRadius: 2, background: d.mood == null ? 'var(--card-border)' : MOOD_COLOUR[d.mood], opacity: d.mood == null ? 0.6 : 0.95 }} />)}
              </div>
            )}
          </section>

          <section aria-label="Journal" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <div style={label}>Journal</div>
              <div style={small}>{streak.current > 0 ? `${plural(streak.current, 'day')} in a row${streak.best > streak.current ? ` · best ${streak.best}` : ''}` : 'Start a streak today'}</div>
            </div>
            <div style={{ ...small, fontSize: 13.5 }}>{prompt}</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={small}>Intention</span>
              <input value={draft.intention} onChange={e => edit({ intention: e.target.value })} placeholder="What would make today a good day?" style={{ ...area, resize: 'none' }} />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={small}>Grateful for</span>
              {draft.gratitude.map((g, i) => <input key={i} aria-label={`Grateful for ${i + 1}`} value={g} onChange={e => editG(i, e.target.value)} placeholder={['Something small', 'Someone', 'Something you did'][i]} style={{ ...area, resize: 'none' }} />)}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={small}>Reflection</span>
              <textarea rows={4} value={draft.reflection} onChange={e => edit({ reflection: e.target.value })} placeholder="What happened, what did you learn, what will you do differently?" style={area} />
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="button" style={journalHasContent(draft) && dirty ? primary : btn} disabled={!journalHasContent(draft) || saving} onClick={saveJournal}>{todayNote ? 'Update entry' : 'Save entry'}</button>
              <span style={small}>{dirty ? 'Unsaved changes' : todayNote ? 'Saved. Also in Notes.' : ''}</span>
            </div>
          </section>

          <section aria-label="Reset" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={label}>Reset</div>
              <button type="button" style={linkBtn} onClick={() => setBreathing(b => !b)} aria-expanded={breathing}>{breathing ? 'Hide breathing' : 'Breathe for a few minutes'}</button>
            </div>
            {breathing ? <BreathingTool /> : <div style={small}>Box, 4-7-8 and a quick reset, with a guided circle.</div>}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section aria-label="Quick note" style={CARD}>
            <div style={label}>Capture</div>
            <textarea rows={3} aria-label="Quick note" value={capture} onChange={e => setCapture(e.target.value)} placeholder="An idea, a thought, something to remember…" style={area}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') quickNote(); }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={capture.trim() ? primary : btn} onClick={quickNote} disabled={!capture.trim()}>Save note</button>
              <button type="button" style={btn} onClick={() => go('notes')}>All notes</button>
            </div>
            {recent.map(n => (
              <button key={n.id} type="button" onClick={() => go('notes')} style={{ all: 'unset', cursor: 'pointer', display: 'block', padding: '8px 0', borderTop: '0.5px solid var(--card-border)' }}>
                <span style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled'}</span>
              </button>
            ))}
          </section>

          <section aria-label="Decisions to revisit" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={label}>Decisions to revisit{revisit.length ? ` · ${revisit.length}` : ''}</div>
              <button type="button" style={linkBtn} onClick={() => go('mind')}>Ledger</button>
            </div>
            {revisit.length === 0 && <div style={{ ...small, fontSize: 13.5 }}>Nothing due. Log a decision in your ledger with a review date and it comes back here.</div>}
            {revisit.map(d => (
              <div key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '0.5px solid var(--card-border)' }}>
                <div style={{ fontSize: 14.5, color: 'var(--text-primary)', fontWeight: 600 }}>{d.title}</div>
                <div style={small}>{d.daysAgo != null ? `${plural(d.daysAgo, 'day')} ago` : ''}{d.expectedOutcome ? ` · you expected: ${d.expectedOutcome}` : ''}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input aria-label={`How did ${d.title} turn out?`} value={outcome[d.id] || ''} onChange={e => setOutcome(o => ({ ...o, [d.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveOutcome(d); }} placeholder="How did it turn out?" style={{ ...area, resize: 'none', flex: 1, minWidth: 0 }} />
                  <button type="button" style={btn} onClick={() => saveOutcome(d)}>Save</button>
                </div>
              </div>
            ))}
          </section>

          <section aria-label="Reading and watching" style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={label}>In progress</div>
              <button type="button" style={linkBtn} onClick={() => go('lists')}>Lists</button>
            </div>
            {glance.inProgress.length === 0 && <div style={{ ...small, fontSize: 13.5 }}>{glance.total ? `${glance.upNext} up next. Start one and it shows here.` : 'Add books, shows or podcasts to your lists.'}</div>}
            {glance.inProgress.map(i => <div key={i.id} style={{ fontSize: 14.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>)}
            {glance.inProgress.length > 0 && glance.upNext > 0 && <div style={small}>{glance.upNext} more up next</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
