// GuideImport — copies Rob's 25 Sep guide into the app (programs, exercises, meals, supplements,
// skin steps, a reference note) so none of it is typed by hand. It shows what will be added and
// what is left alone, and writes nothing until Import is tapped. Anything you already have by
// the same name is kept, so it is safe to tap twice. Rules and data: src/domain/guideImport.js.
import { useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument } from '../supabase/useDocument.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { updateSettings } from '../utils/settingsStore.js';
import { label } from './ui.js';
import { buildGuideImport, summarise, isEmpty, GUIDE_ID, GUIDE_TITLE } from '../domain/guideImport.js';

const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
const btn = (primary) => ({ minHeight: 46, padding: '0 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--bg-base)' : 'var(--text-primary)' });
const small = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };

export default function GuideImport({ settings }) {
  const exDoc = useDocument('overload_exercises', STORAGE_KEYS.OVERLOAD_EXERCISES, null);
  const programs = useCollection('programs', STORAGE_KEYS.PROGRAMS);
  const meals = useCollection('saved_meals', STORAGE_KEYS.SAVED_MEALS);
  const supps = useCollection('supplements', STORAGE_KEYS.SUPPLEMENTS);
  const notes = useCollection('notes', STORAGE_KEYS.NOTES);
  const habits = useCollection('habits', STORAGE_KEYS.HABITS);
  const lm = useDocument('lm_profile', 'valerie_lm_profile', {});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const ready = exDoc.synced && lm.synced && programs.synced && meals.synced && supps.synced && notes.synced && habits.synced;
  const library = Array.isArray(exDoc.data) ? exDoc.data : [];
  const skinSteps = Array.isArray(lm.data?.skinSteps) ? lm.data.skinSteps : [];

  const plan = useMemo(() => buildGuideImport({
    library, programs: programs.items || [], savedMeals: meals.items || [], supplements: supps.items || [],
    skinSteps, skinProfile: lm.data?.skinProfile || null, notes: notes.items || [], habits: habits.items || [],
  }), [library, programs.items, meals.items, supps.items, skinSteps, lm.data, notes.items, habits.items]);

  const done = settings?.guideImport?.id === GUIDE_ID;
  const nothing = isEmpty(plan);

  async function run() {
    if (!ready || busy || nothing) return;
    setBusy(true); setMessage('');
    const lines = [];
    try {
      if (plan.exercises.length) {
        const ok = await exDoc.save([...library, ...plan.exercises]);
        if (ok === false) throw new Error('could not save the exercise library');
        lines.push(`${plan.exercises.length} exercises added to your library.`);
      }
      if (plan.programs.length) {
        // The guide starts with the re-entry block; the programs you had stay, switched off.
        if (plan.programs.some(p => p.isActive)) for (const pr of programs.items || []) if (pr.isActive) await programs.update(pr.id, { isActive: false });
        for (const p of plan.programs) await programs.add(p);
        lines.push(`${plan.programs.length} programs added (${plan.programs.filter(p => p.isActive).map(p => p.name).join(', ') || 'none'} active).`);
      }
      for (const m of plan.meals) await meals.add(m);
      if (plan.meals.length) lines.push(`${plan.meals.length} meals saved.`);
      for (const s of plan.supplements) await supps.add(s);
      if (plan.supplements.length) lines.push(`${plan.supplements.length} supplements added.`);
      for (const h of plan.habits) await habits.add(h);
      if (plan.habits.length) lines.push(`${plan.habits.length} daily habits added.`);
      if (plan.skinSteps.length || plan.skinProfile) {
        await lm.save({ ...(lm.data || {}), skinSteps: [...skinSteps, ...plan.skinSteps], ...(plan.skinProfile ? { skinProfile: plan.skinProfile } : {}) });
        if (plan.skinSteps.length) lines.push(`${plan.skinSteps.length} skin steps added.`);
      }
      if (plan.note) { await notes.add({ title: plan.note.title, body: plan.note.body, pinned: false }); lines.push('Reference note added to Notes.'); }
      updateSettings({ guideImport: { id: GUIDE_ID, doneOn: toLocalDateKey(new Date()) } });
      setMessage(lines.join(' '));
      setOpen(false);
    } catch (e) {
      setMessage(`${lines.join(' ')} Stopped: ${e?.message || e}. What was added stays; tap Import again to add the rest (nothing is added twice).`);
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Import my guide" style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={label}>Import my guide</div>
        {done && <span style={small}>Imported {settings.guideImport.doneOn}</span>}
      </div>
      <div style={small}>{GUIDE_TITLE}: training programs, the two bowls and snacks, creatine and whey, the skin routine and a reference note. Copied from the guide, nothing invented. Things you already have are left alone.</div>

      {!open && !message && (
        <div>
          <button type="button" onClick={() => setOpen(true)} disabled={!ready} style={btn(false)}>
            {!ready ? 'Loading your data…' : nothing ? 'Review (nothing new to add)' : 'Review what will be added'}
          </button>
        </div>
      )}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {nothing
            ? <div role="status" style={{ fontSize: 14, color: 'var(--text-primary)' }}>Everything in the guide is already in the app.</div>
            : <div role="status" style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600 }}>Will add: {summarise(plan).join(', ')}.</div>}

          {plan.programs.map(p => (
            <div key={p.name} style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              <strong>{p.name}</strong>{p.isActive ? ' (becomes your active program)' : ' (added, not active)'}
              <div style={small}>{p.note}</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, ...small }}>
                {Object.values(p.days).filter(d => d.splitType !== 'rest').map((d, i) => <li key={i}>{d.label}: {d.exerciseIds.length} exercises</li>)}
              </ul>
            </div>
          ))}
          {plan.meals.length > 0 && (
            <div style={small}>Meals: {plan.meals.map(m => `${m.name} (${m.calories} kcal, ${m.protein} g protein)`).join('; ')}. The guide gives no carbs or fat for the three snacks, so those show 0.</div>
          )}
          {plan.habits.length > 0 && <div style={small}>Habits: {plan.habits.map(h => h.name).join('; ')}.</div>}
          {plan.skinSteps.length > 0 && <div style={small}>Skin steps: {plan.skinSteps.map(s => s.name).join('; ')}. Azelaic acid is not added: the guide starts it only after 2 calm weeks (see the note).</div>}
          {plan.kept.length > 0 && <div style={small}>Left as they are: {plan.kept.join('; ')}.</div>}
          {plan.problems.length > 0 && <div role="alert" style={{ ...small, color: '#e8a13a' }}>Skipped: {plan.problems.join('; ')}.</div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!nothing && <button type="button" onClick={run} disabled={busy} style={btn(true)}>{busy ? 'Importing…' : 'Import'}</button>}
            <button type="button" onClick={() => setOpen(false)} disabled={busy} style={btn(false)}>{nothing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {message && <div role="status" style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{message}</div>}
    </section>
  );
}
