// PasteApply — paste a meal plan or a training plan written anywhere (Claude, ChatGPT, a coach,
// your own notes) and the app works out which it is and applies it. No AI is involved: it reads
// the JSON a prompt asked for, or plain lines like "Bench Press 3x8-10" and "Breakfast: Oats 450 kcal".
// Both readers are deterministic (domain/workoutImport.js, domain/mealPlanImport.js), you see exactly
// what was understood before anything is saved, and nothing is saved until you tap Apply.
//   props: kind  'auto' (default) | 'meal' | 'workout'  to lock it to one thing.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { detectKind, parseWorkoutPlan, buildWorkoutImport, buildWorkoutPrompt } from '../domain/workoutImport.js';
import { parseMealPlan, mergePlans, withTotals } from '../domain/mealPlanImport.js';
import { label } from './ui.js';

const field = { width: '100%', boxSizing: 'border-box', padding: 10, minHeight: 140, borderRadius: 10, border: '0.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' };
const btn = (primary) => ({ minHeight: 44, padding: '0 18px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 700 : 500, border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--bg-base)' : 'var(--text-primary)' });
const dim = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };
const toast = (message, type = 'success') => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));

export default function PasteApply({ kind = 'auto', title = 'Paste and apply' }) {
  const exDoc = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const programs = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const planDoc = useDocument('meal_plan', STORAGE_KEYS.MEAL_PLANS, null);

  const [text, setText] = useState('');
  const [read, setRead] = useState(null); // { kind, ok, ... }
  const [makeActive, setMakeActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const library = Array.isArray(exDoc.data) ? exDoc.data : [];
  const existingPlan = Array.isArray(planDoc.data?.plan) && planDoc.data.plan.some(d => d.meals?.length) ? planDoc.data.plan : null;

  function readIt() {
    const found = kind === 'auto' ? detectKind(text) : kind;
    if (!found) { setRead({ ok: false, reason: 'I could not tell what this is. A meal plan has calories ("450 kcal"); a training plan has sets and reps ("Bench Press 3x8-10").' }); return; }
    if (found === 'meal') setRead({ kind: 'meal', ...parseMealPlan(text) });
    else {
      const parsed = parseWorkoutPlan(text);
      setRead(parsed.ok ? { kind: 'workout', parsed, build: buildWorkoutImport(parsed, { library, programs: programs.items || [] }), ok: true } : { kind: 'workout', ...parsed });
    }
  }

  const prompt = useMemo(() => buildWorkoutPrompt(), []);
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { toast('Could not copy. Select the text and copy it by hand.', 'error'); }
  }

  async function apply(mode) {
    if (!read?.ok || busy) return;
    setBusy(true);
    try {
      if (read.kind === 'meal') {
        const next = mode === 'merge' && existingPlan ? mergePlans(existingPlan, read.plan) : withTotals(read.plan);
        const ok = await planDoc.save({ generatedOn: toLocalDateKey(new Date()), plan: next, source: 'paste' });
        if (ok === false) throw new Error('could not save the meal plan');
        toast(`Meal plan saved (${read.meals} meals). Open Fuel > Meal Plan to see it.`);
      } else {
        const b = read.build;
        if (b.exercises.length) {
          const ok = await exDoc.save([...library, ...b.exercises]);
          if (ok === false) throw new Error('could not save the exercise library');
        }
        const row = { ...b.program, isActive: makeActive };
        if (makeActive) for (const p of programs.items || []) if (p.isActive) await programs.update(p.id, { isActive: false });
        const id = await programs.add(row);
        if (!id) throw new Error('could not save the program');
        toast(`Program "${row.name}" added${makeActive ? ' and made active' : ''}. Open Train > Split to see it.`);
      }
      setText(''); setRead(null);
    } catch (err) {
      toast(err?.message ? `Not saved: ${err.message}` : 'Not saved. Try again.', 'error');
    } finally { setBusy(false); }
  }

  const w = read?.ok && read.kind === 'workout' ? read : null;
  return (
    <details style={{ padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
      <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ ...label, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{kind === 'workout' ? 'training plan' : kind === 'meal' ? 'meal plan' : 'meal or training plan'}</span>
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        <div style={dim}>
          Paste a plan from Claude, ChatGPT, a coach or your own notes. The app reads it with fixed rules, not AI: it looks for day headings, exercise lines such as "Bench Press 3x8-10", and meal lines with calories. You see what it understood before anything is saved.
        </div>
        <textarea aria-label="Paste a plan" value={text} onChange={e => { setText(e.target.value); setRead(null); }} placeholder="Paste here" style={field} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btn(true)} disabled={!text.trim()} onClick={readIt}>Read it</button>
          {kind !== 'meal' && <button type="button" style={btn(false)} onClick={copyPrompt}>{copied ? 'Copied' : 'Copy a training-plan prompt for an AI'}</button>}
        </div>

        {read && !read.ok && <div role="alert" style={{ fontSize: 13, color: '#e25d7a', padding: '8px 12px', borderRadius: 10, background: 'rgba(226,93,122,0.08)', border: '0.5px solid rgba(226,93,122,0.25)' }}>{read.reason}</div>}

        {read?.ok && read.kind === 'meal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Meal plan: {read.meals} meals across {read.plan.length} day{read.plan.length === 1 ? '' : 's'}</div>
            {read.plan.map(d => <div key={d.day} style={dim}><b style={{ color: 'var(--text-primary)' }}>{d.day}</b> · {d.meals.map(m => m.name).join(', ')} · {d.totals.calories} kcal</div>)}
            {read.warnings.map((m, i) => <div key={i} style={{ ...dim, color: '#f4a642' }}>{m}</div>)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={btn(true)} disabled={busy} onClick={() => { if (!existingPlan || window.confirm('Replace your current meal plan?')) apply('replace'); }}>{existingPlan ? 'Replace my meal plan' : 'Save as my meal plan'}</button>
              {existingPlan && <button type="button" style={btn(false)} disabled={busy} onClick={() => apply('merge')}>Add to my meal plan</button>}
            </div>
          </div>
        )}

        {w && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Training plan "{w.build.program.name}": {w.build.trainingDays} training day{w.build.trainingDays === 1 ? '' : 's'}</div>
            {w.parsed.days.filter(d => d.key).map(d => (
              <div key={d.key} style={dim}><b style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{d.key}</b> · {d.rest || !d.exercises.length ? 'Rest' : `${d.label || 'Training'}: ${d.exercises.map(e => `${e.name} ${e.sets}${e.repsMin ? `x${e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}-${e.repsMax}`}` : ''}`).join(', ')}`}</div>
            ))}
            {w.build.matched.length > 0 && <div style={dim}>Read as the closest database lift: {w.build.matched.map(m => `${m.asked} → ${m.as}`).join('; ')}</div>}
            {w.build.custom.length > 0 && <div style={{ ...dim, color: '#f4a642' }}>Not in the exercise database, added as your own (no starting weight): {w.build.custom.join(', ')}</div>}
            {w.parsed.problems.map((m, i) => <div key={i} style={{ ...dim, color: '#f4a642' }}>{m}</div>)}
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={makeActive} onChange={e => setMakeActive(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
              Make it my active program (your other programs are kept, switched off)
            </label>
            <button type="button" style={{ ...btn(true), alignSelf: 'flex-start' }} disabled={busy || !exDoc.synced} onClick={() => apply()}>Add this program</button>
          </div>
        )}
      </div>
    </details>
  );
}
