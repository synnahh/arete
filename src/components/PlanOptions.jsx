// PlanOptions — keep a plan or coaching brief from somewhere else (Claude, ChatGPT, a coach) as an OPTION
// beside your real plan. Adding one never changes your goal, targets, programs, meals or logs: its text is a
// read-only reference, and any daily targets it states are previewed against what you use now. You can
// apply those targets on purpose (with Undo, logged in Coach updates) or just leave the option there.
// Rules: domain/planOptions.js. Stored in the `plan_options` document.
import { useState } from 'react';
import { useDocument } from '../supabase/useDocument.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { updateSettings } from '../utils/settingsStore.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { settingsForGoal } from '../domain/goals.js';
import { logEntry, pushLog } from '../domain/coachEngine.js';
import { makeOption, addOption, removeOption, compareTargets, appliable } from '../domain/planOptions.js';
import { label } from './ui.js';

const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
const field = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 10, border: '0.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };
const btn = (primary) => ({ minHeight: 44, padding: '0 16px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 700 : 500, border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--bg-base)' : 'var(--text-primary)' });
const dim = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };
const toast = (message, type = 'success', undo) => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type, ...(undo ? { undo } : {}) } }));

export default function PlanOptions({ settings = {} }) {
  const doc = useDocument('plan_options', 'valerie_plan_options', { items: [] });
  const items = Array.isArray(doc.data?.items) ? doc.data.items : [];
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const goal = settings.coachGoal;
  const preview = text.trim() ? makeOption({ name, text }) : null;

  async function save() {
    const option = makeOption({ name, text, savedOn: toLocalDateKey(new Date()) });
    if (!option || busy) return;
    setBusy(true);
    try {
      const ok = await doc.save({ items: addOption(items, option) });
      if (ok === false) throw new Error('could not save');
      setText(''); setName(''); setOpen(option.id);
      toast(`Saved "${option.name}" as an option. Nothing else was changed.`);
    } catch { toast('Not saved. Try again.', 'error'); }
    finally { setBusy(false); }
  }

  async function remove(o) {
    if (!window.confirm(`Delete the option "${o.name}"? Your real plan is not affected.`)) return;
    const before = items;
    const ok = await doc.save({ items: removeOption(items, o.id) });
    if (ok !== false) toast(`Deleted "${o.name}"`, 'success', () => doc.save({ items: before }));
  }

  function apply(o) {
    const t = o.targets;
    const current = storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
    const g = current.coachGoal;
    if (!g?.targets || !appliable(t)) return;
    const rows = compareTargets(g.targets, t).map(r => `${r.label}: ${r.now ?? '?'} → ${r.next}${r.unit === 'g' ? ' g' : ''}`).join('\n');
    if (!window.confirm(`Apply "${o.name}" targets to your plan?\n\n${rows}\n\nYou can undo this right after, or from Coach updates.`)) return;
    const next = { ...g, targets: { ...g.targets, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }, targetsSource: `option:${o.id}` };
    const entry = logEntry({ key: 'option', title: `Applied option "${o.name}"`, why: `You applied the targets from your saved option "${o.name}": ${t.kcal} kcal, ${t.protein} g protein, ${t.carbs} g carbs, ${t.fat} g fat. The coach may adjust them later from your logs.` }, 'applied', { before: { goal: g }, after: { goal: next } });
    updateSettings({ ...settingsForGoal(next, current.macros), coachLog: pushLog(current.coachLog, entry) }, current);
    toast(`Targets set from "${o.name}"`, 'success', () => {
      const now = storage.get(STORAGE_KEYS.SETTINGS, {}) || {};
      const log = Array.isArray(now.coachLog) ? now.coachLog.map(e => (e.id === entry.id ? { ...e, status: 'undone' } : e)) : [];
      updateSettings({ ...settingsForGoal(g, now.macros), coachLog: log }, now);
    });
  }

  return (
    <section aria-label="Plan options" style={card}>
      <div style={label}>Plan options</div>
      <div style={dim}>Keep a plan or coaching brief from Claude, ChatGPT or a coach here as an option. Saving one changes nothing in your real plan. You can read it any time, compare its targets with yours, and apply them later if you choose.</div>

      {items.map(o => {
        const rows = o.targets && goal?.targets ? compareTargets(goal.targets, o.targets) : [];
        const isOpen = open === o.id;
        return (
          <div key={o.id} style={{ border: '0.5px solid var(--card-border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : o.id)} aria-expanded={isOpen} style={{ all: 'unset', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)' }}>{o.targets ? `${o.targets.kcal} kcal · ${o.targets.protein} g protein${o.targets.carbs ? ` · ${o.targets.carbs} g carbs` : ''}${o.targets.fat ? ` · ${o.targets.fat} g fat` : ''}` : 'Reference only (no daily targets found)'}{o.savedOn ? ` · saved ${o.savedOn}` : ''}</span>
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{isOpen ? 'Hide' : 'Open'}</span>
            </button>
            {isOpen && (
              <>
                {o.targets && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{goal?.targets ? 'Compared with your current targets' : 'Set a goal first to compare or apply'}</div>
                    {rows.map(r => (
                      <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                        <span>{r.label}</span>
                        <span className="val-num">{r.now ?? '–'} → <b style={{ color: 'var(--text-primary)' }}>{r.next}</b>{r.delta ? <span style={{ color: r.delta > 0 ? '#e8a13a' : '#4caf7d' }}> ({r.delta > 0 ? '+' : ''}{r.delta})</span> : ''}</span>
                      </div>
                    ))}
                    {(o.targets.fibre || o.targets.steps) && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Also in the brief: {[o.targets.fibre && `fibre at least ${o.targets.fibre} g`, o.targets.steps && `about ${o.targets.steps.toLocaleString('en-AU')} steps a day`].filter(Boolean).join(', ')} (not applied automatically).</div>}
                    {o.targets.notes.map((n, i) => <div key={i} style={{ fontSize: 12.5, color: '#e8a13a' }}>{n}</div>)}
                  </div>
                )}
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', background: 'var(--hover-bg)', padding: 12, borderRadius: 10, maxHeight: 320, overflow: 'auto', userSelect: 'text' }}>{o.text}</pre>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {appliable(o.targets) && <button type="button" style={btn(true)} disabled={!goal?.targets} onClick={() => apply(o)}>Apply these targets</button>}
                  <button type="button" style={btn(false)} onClick={() => remove(o)}>Delete option</button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <details style={{ borderTop: items.length ? '0.5px solid var(--card-border)' : 'none', paddingTop: items.length ? 12 : 0 }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', listStyle: 'none' }}>+ Add an option</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <input aria-label="Option name" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} maxLength={60} style={field} />
          <textarea aria-label="Paste the plan or brief" placeholder="Paste here" value={text} onChange={e => setText(e.target.value)} style={{ ...field, padding: 10, minHeight: 160, resize: 'vertical', fontSize: 14 }} />
          {preview && (
            <div style={dim}>
              {preview.targets
                ? <>Found daily targets: <b style={{ color: 'var(--text-primary)' }}>{preview.targets.kcal} kcal, {preview.targets.protein} g protein{preview.targets.carbs ? `, ${preview.targets.carbs} g carbs` : ''}{preview.targets.fat ? `, ${preview.targets.fat} g fat` : ''}</b>. They are saved with the option but not applied.</>
                : 'No daily calorie and protein targets found. It will be saved as a reference only.'}
            </div>
          )}
          <button type="button" style={{ ...btn(true), alignSelf: 'flex-start' }} disabled={!preview || busy || !doc.synced} onClick={save}>Save as an option</button>
        </div>
      </details>
    </section>
  );
}
