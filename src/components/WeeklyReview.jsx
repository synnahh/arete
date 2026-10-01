// WeeklyReview.jsx — whole-life AI review across every domain.
// Opened via the `valerie:weekly-review` event (e.g. from Ctrl+K). Gathers a
// cross-domain snapshot from local data and asks Claude for a structured review,
// including cross-domain correlations (e.g. sleep ↔ spending ↔ appearance).

import { useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { askClaudeRaw } from '../utils/claudeRaw.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { withLiveStreaks } from '../domain/habits.js';

const arr = (k) => { const v = storage.get(k, []); return Array.isArray(v) ? v : (v?.daily || []); };
const within = (dateStr, days) => { if (!dateStr) return false; const d = new Date(dateStr); return (Date.now() - d) <= days * 86400000 && d <= new Date(); };
const avg = (nums) => nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : null;

function buildWeeklyContext() {
  const L = [];
  const t = toLocalDateKey(new Date());

  // Tasks
  try {
    const tasks = arr(STORAGE_KEYS.TASKS);
    const open = tasks.filter(x => !x.done && !x.completed);
    const doneWk = tasks.filter(x => x.done || x.completed).filter(x => within(x.updatedAt ? new Date(x.updatedAt).toISOString() : x.dueDate, 7));
    L.push(`Tasks: ${open.length} open (${open.filter(x => x.priority === 'high').length} high-priority), ~${doneWk.length} completed this week`);
  } catch {}

  // Calendar
  try {
    const ev = arr(STORAGE_KEYS.EVENTS).filter(e => e.date >= t).slice(0, 6);
    L.push(`Upcoming events: ${ev.length ? ev.map(e => `${e.title}@${e.date}`).join(', ') : 'none'}`);
  } catch {}

  // Finance (7-day)
  try {
    const txns = arr(STORAGE_KEYS.TRANSACTIONS);
    const wk = txns.filter(x => within(x.date, 7));
    const income = wk.filter(x => x.type === 'income').reduce((s, x) => s + (x.amount || 0), 0);
    const expense = wk.filter(x => x.type === 'expense').reduce((s, x) => s + (x.amount || 0), 0);
    const byCat = {};
    wk.filter(x => x.type === 'expense').forEach(x => { byCat[x.category || 'Other'] = (byCat[x.category || 'Other'] || 0) + (x.amount || 0); });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    L.push(`Finance (7d): income $${income.toFixed(0)}, expense $${expense.toFixed(0)}${topCat ? `, top spend ${topCat[0]} $${topCat[1].toFixed(0)}` : ''}`);
  } catch {}

  // Health
  try {
    const body = [...arr(STORAGE_KEYS.BODY)].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
    if (body) L.push(`Body: ${body.weight || '?'}kg${body.bodyFat ? `, ${body.bodyFat}% bf` : ''}`);
    const sleep = arr(STORAGE_KEYS.SLEEP).filter(s => within(s.date, 7));
    const avgSleepH = avg(sleep.map(s => (s.duration || 0) / 60));
    if (avgSleepH) L.push(`Sleep (7d avg): ${avgSleepH.toFixed(1)}h`);
    const nut = arr(STORAGE_KEYS.MACROS).filter(n => within(n.date, 7));
    const avgProt = avg(nut.map(n => n.protein || 0));
    if (avgProt) L.push(`Nutrition (7d avg): ${Math.round(avgProt)}g protein`);
  } catch {}

  // LM appearance
  try {
    const lm = storage.get('valerie_lm_profile', {}) || {};
    if (lm.phase) L.push(`Looksmaxxing phase: ${lm.phase}`);
    if (lm.scorecard) {
      const vals = Object.values(lm.scorecard).map(v => v?.current).filter(v => v != null);
      if (vals.length) L.push(`Appearance scorecard avg: ${(vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(1)}/10`);
    }
    const lmDaily = arr('valerie_lm_daily').filter(d => within(d.date, 7));
    if (lmDaily.length) L.push(`LM daily-tracker completion (7d avg): ${Math.round(avg(lmDaily.map(d => d.pct || 0)))}%`);
  } catch {}

  // Habits / focus / mood
  try {
    const habits = withLiveStreaks(arr(STORAGE_KEYS.HABITS), toLocalDateKey(new Date())).filter(h => (h.streak || 0) > 0).sort((a, b) => (b.streak || 0) - (a.streak || 0)).slice(0, 4);
    if (habits.length) L.push(`Habit streaks: ${habits.map(h => `${h.name} (${h.streak}d)`).join(', ')}`);
    const focus = arr(STORAGE_KEYS.FOCUS_SESSIONS).filter(s => within(s.completedAt || s.date, 7));
    if (focus.length) L.push(`Focus sessions this week: ${focus.length}`);
    const mood = arr(STORAGE_KEYS.MOOD_LOGS).filter(m => within(m.date, 7));
    const avgMood = avg(mood.map(m => m.value || 0));
    if (avgMood) L.push(`Mood (7d avg): ${avgMood.toFixed(1)}/10`);
  } catch {}

  return L.join('\n');
}

const SYSTEM = (ctx) => `You are generating Rob's WHOLE-LIFE WEEKLY REVIEW from his real dashboard data below. Be sharp, specific, and reference his actual numbers. Cover, with short scannable bullets under clear headers:
1. WINS — what went well this week across all domains
2. WATCH-OUTS — where he slipped or risks are building
3. CROSS-DOMAIN PATTERNS — connections BETWEEN domains (e.g. low sleep weeks ↔ higher spending or worse mood; training consistency ↔ appearance scores). Only claim patterns the data supports; if data is thin, say what to start tracking.
4. THIS WEEK'S ONE FOCUS — the single highest-leverage thing to prioritise next week.
No fluff, no preamble, no markdown symbols read aloud. Plain text headers + dashes.

ROB'S DATA:
${ctx}`;

export default function WeeklyReview() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    const handler = () => { setOpen(true); run(); };
    window.addEventListener('valerie:weekly-review', handler);
    return () => window.removeEventListener('valerie:weekly-review', handler);
  }, []);

  async function run() {
    setLoading(true); setResult('');
    try {
      const reply = await askClaudeRaw('Generate my whole-life weekly review now.', SYSTEM(buildWeeklyContext()));
      setResult(reply);
    } catch (err) { setResult(`Couldn't generate the review: ${err.message}`); }
    finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <div onClick={() => setOpen(false)} style={{
      position: 'fixed', inset: 0, zIndex: 920, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '100%', maxHeight: '82vh', background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '0.5px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-primary)' }}>Weekly Review</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em' }}>WHOLE-LIFE · AI</div>
          <div style={{ flex: 1 }} />
          {!loading && <button onClick={run} style={{ background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Regenerate</button>}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ padding: '18px 24px 24px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--card-border)', borderTopColor: 'var(--accent)', animation: 'wrSpin 0.7s linear infinite' }} />
              Analysing your week across every domain…
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{result}</div>
          )}
        </div>
        <style>{`@keyframes wrSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
