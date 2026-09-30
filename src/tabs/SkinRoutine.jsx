//  Skin routine  Skinbliss-style: today's AM/PM checklist, a step builder,
//  ingredient-conflict warnings, and steps linked to Supplies so a routine
//  says how much of each product you use, and the Ahead engine says when it
//  runs out. Logic: src/domain/skin.js.
import { useMemo, useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import ProgressPhotos from '../components/ProgressPhotos.jsx';
import ProductCheck from '../components/ProductCheck.jsx';
import {
  ALL_DAYS, WHEN_LABEL, RATING_LABELS, newStep, usesPerDay, supplyUsage, stepsFor, completion, routineWarnings, ratingTrend, routineInsight,
} from '../domain/skin.js';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };
const label = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' };
const input = { width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', borderRadius: 10, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14 };
const pill = (on) => ({
  minHeight: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
  border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
  background: on ? 'color-mix(in srgb, var(--tab-accent) 14%, transparent)' : 'transparent',
  color: on ? 'var(--tab-accent)' : 'var(--text-secondary)', fontWeight: on ? 600 : 500,
});
const primaryBtn = { height: 40, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, background: 'var(--tab-accent)', color: 'var(--on-tab-accent)' };

//  Today's checklist for one period
function Checklist({ title, steps, ticks, weekday, period, onToggle }) {
  const todays = stepsFor(steps, period, weekday);
  const { done, total } = completion(steps, ticks, period, weekday);
  return (
    <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        <span className="val-num" style={{ fontSize: 12, color: total && done === total ? 'var(--tab-accent)' : 'var(--text-secondary)' }}>{done}/{total}</span>
      </div>
      {todays.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing scheduled.</span>}
      {todays.map(s => {
        const on = !!ticks[s.id];
        return (
          <button key={s.id} type="button" aria-pressed={on} onClick={() => onToggle(period, s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            background: on ? 'color-mix(in srgb, var(--tab-accent) 10%, transparent)' : 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
          }}>
            <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: on ? 'none' : '1.5px solid var(--card-border)', background: on ? 'var(--tab-accent)' : 'transparent', color: 'var(--on-tab-accent)' }}>
              {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>}
            </span>
            <span style={{ fontSize: 14, color: on ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: on ? 'line-through' : 'none' }}>{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function SkinRoutine({ profile, saveProfile, daily }) {
  const supplies = useCollection('essentials', STORAGE_KEYS.ESSENTIALS);
  const steps = useMemo(() => (Array.isArray(profile?.skinSteps) ? profile.skinSteps : []), [profile?.skinSteps]);
  const [name, setName] = useState('');
  const [when, setWhen] = useState('both');
  const busy = useRef(false);

  const todayKey = toLocalDateKey(new Date());
  const weekday = new Date().getDay();
  const todayRow = daily.items.find(d => d.date === todayKey);
  const skinTicks = todayRow?.skin ?? {};
  const warnings = useMemo(() => routineWarnings(steps), [steps]);

  // Save the routine, then keep every linked supply's usage in step with it.
  async function commit(next) {
    const prev = steps;
    await saveProfile({ ...profile, skinSteps: next });
    const ids = new Set([...prev, ...next].map(s => s.supplyId).filter(Boolean));
    for (const id of ids) {
      const usage = supplyUsage(next, id);
      if (usage > 0 && supplies.items.some(s => s.id === id)) await supplies.update(id, { usesPerDay: usage });
    }
  }

  const patch = (id, changes) => commit(steps.map(s => (s.id === id ? { ...s, ...changes } : s)));
  const remove = (id) => commit(steps.filter(s => s.id !== id));

  async function addStep() {
    if (!name.trim()) return;
    await commit([...steps, newStep(name, when)]);
    setName('');
  }

  async function createSupply(step) {
    const id = await supplies.add({
      name: step.name, category: 'grooming', boughtDate: todayKey, packsOnHand: 1,
      usesPerDay: usesPerDay(step), createdAt: new Date().toISOString(),
    });
    if (id) await patch(step.id, { supplyId: id });
  }

  function linkSupply(step, value) {
    if (value === '__new') return createSupply(step);
    return patch(step.id, { supplyId: value || null });
  }

  // Add a checked product: a routine step, and (optionally) a Supply with its shelf life,
  // linked so the routine drives its run-out forecast.
  async function addFromProduct({ name: pName, when: pWhen, paoMonths, track }) {
    const step = newStep(pName, pWhen);
    let linked = step;
    if (track) {
      const id = await supplies.add({
        name: pName, category: 'grooming', boughtDate: todayKey, packsOnHand: 1,
        usesPerDay: usesPerDay(step), ...(paoMonths ? { paoMonths } : {}), createdAt: new Date().toISOString(),
      });
      if (id) linked = { ...step, supplyId: id };
    }
    await commit([...steps, linked]);
  }

  // Turn the old free-text routine into steps (the text itself is kept).
  const legacy = profile?.skinRoutines || {};
  const legacyLines = (text) => String(text || '').split('\n').map(l => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);
  const importable = ['morning', 'night'].flatMap(k => legacyLines(legacy[k]).map(n => ({ n, when: k === 'morning' ? 'am' : 'pm' })))
    .filter(({ n, when: w }) => !steps.some(s => s.name.toLowerCase() === n.toLowerCase() && (s.when === w || s.when === 'both')));
  const importLegacy = () => commit([...steps, ...importable.map(({ n, when: w }) => newStep(n, w))]);

  async function toggle(period, stepId) {
    if (busy.current) return; // a second tap before the row exists would create a duplicate day
    busy.current = true;
    try {
      const next = { ...skinTicks, [period]: { ...(skinTicks[period] || {}), [stepId]: !(skinTicks[period] || {})[stepId] } };
      if (todayRow) await daily.update(todayRow.id, { skin: next });
      else await daily.add({ date: todayKey, items: {}, pct: 0, skin: next });
    } finally { busy.current = false; }
  }

  // Daily skin rating (1-5). Tapping the chosen number again clears it.
  async function rate(n) {
    if (busy.current) return;
    busy.current = true;
    try {
      const next = todayRow?.skinRating === n ? null : n;
      if (todayRow) await daily.update(todayRow.id, { skinRating: next });
      else await daily.add({ date: todayKey, items: {}, pct: 0, skinRating: next });
    } finally { busy.current = false; }
  }
  const trend = useMemo(() => ratingTrend(daily.items, todayKey), [daily.items, todayKey]);
  const insight = useMemo(() => routineInsight(daily.items, steps, todayKey), [daily.items, steps, todayKey]);

  const linkedSupply = (s) => supplies.items.find(x => x.id === s.supplyId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <span style={label}>Today · {DAY_NAMES[weekday]}</span>
        {steps.length === 0
          ? <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Build your routine below and today's steps appear here to tick off.</span>
          : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Checklist title="Morning" steps={steps} ticks={skinTicks.am || {}} weekday={weekday} period="am" onToggle={toggle} />
              <Checklist title="Night" steps={steps} ticks={skinTicks.pm || {}} weekday={weekday} period="pm" onToggle={toggle} />
            </div>
          )}
      </div>

      <div style={card}>
        <span style={label}>How does your skin look today?</span>
        <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Skin rating">
          {[1, 2, 3, 4, 5].map(n => {
            const on = todayRow?.skinRating === n;
            return (
              <button key={n} type="button" aria-pressed={on} aria-label={`${n} of 5, ${RATING_LABELS[n]}`} onClick={() => rate(n)} style={{
                flex: 1, minHeight: 52, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                border: `0.5px solid ${on ? 'var(--tab-accent)' : 'var(--card-border)'}`,
                background: on ? 'color-mix(in srgb, var(--tab-accent) 16%, transparent)' : 'transparent',
                color: on ? 'var(--tab-accent)' : 'var(--text-primary)', WebkitTapHighlightColor: 'transparent',
              }}>
                <span className="val-num" style={{ fontSize: 18, fontWeight: 600 }}>{n}</span>
                <span style={{ fontSize: 10.5, color: on ? 'var(--tab-accent)' : 'var(--text-secondary)' }}>{RATING_LABELS[n]}</span>
              </button>
            );
          })}
        </div>
        {trend.status === 'ok' ? (
          <div role="status" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            This week averages <strong className="val-num" style={{ color: 'var(--text-primary)' }}>{trend.avg}</strong> of 5
            {trend.delta != null && Math.abs(trend.delta) >= 0.2 && <> ({trend.delta > 0 ? 'up' : 'down'} {Math.abs(trend.delta)} on last week)</>}.
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Rate a few days and Arete shows how your skin is trending.</div>
        )}
        {insight && (
          <div role="status" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Days you did most of your routine averaged <strong className="val-num" style={{ color: 'var(--text-primary)' }}>{insight.high.avg}</strong> ({insight.high.days} days);
            days you did little averaged <strong className="val-num" style={{ color: 'var(--text-primary)' }}>{insight.low.avg}</strong> ({insight.low.days} days).
            That is a pattern in your ratings, not proof the routine caused it.
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div role="status" style={{ ...card, gap: 8 }}>
          <span style={{ ...label, color: 'var(--tab-accent)' }}>Check your routine</span>
          {warnings.map(w => (
            <div key={w.text} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.45, color: 'var(--text-primary)' }}>
              <span aria-hidden="true" style={{ color: w.level === 'warn' ? '#e8a13a' : 'var(--text-secondary)', flexShrink: 0 }}>{w.level === 'warn' ? '⚠' : '•'}</span>
              <span><span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{w.level === 'warn' ? 'Warning: ' : 'Tip: '}</span>{w.text}</span>
            </div>
          ))}
        </div>
      )}

      <ProductCheck steps={steps} onAdd={addFromProduct} />

      <div style={card}>
        <span style={label}>Routine builder</span>
        {steps.map(s => {
          const sup = linkedSupply(s);
          return (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderBottom: '0.5px solid var(--card-border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input aria-label="Step name" value={s.name} onChange={e => patch(s.id, { name: e.target.value })} style={{ ...input, flex: 1 }} />
                <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`} style={{ ...pill(false), color: '#e55a5a' }}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {Object.entries(WHEN_LABEL).map(([k, l]) => <button key={k} type="button" aria-pressed={s.when === k} onClick={() => patch(s.id, { when: k })} style={pill(s.when === k)}>{l}</button>)}
                <span style={{ width: 8 }} />
                {ALL_DAYS.map(d => {
                  const on = (s.days ?? ALL_DAYS).includes(d);
                  return (
                    <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]}
                      onClick={() => patch(s.id, { days: on ? s.days.filter(x => x !== d) : [...(s.days ?? ALL_DAYS), d].sort() })}
                      style={{ ...pill(on), width: 32, padding: 0 }}>{DAY_LETTERS[d]}</button>
                  );
                })}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Product in Supplies</span>
                <select value={s.supplyId || ''} onChange={e => linkSupply(s, e.target.value)} style={{ ...input, width: 'auto', minWidth: 200 }}>
                  <option value="">Not tracked</option>
                  {supplies.items.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  <option value="__new">+ Add "{s.name}" to Supplies</option>
                </select>
                {sup && <span className="val-num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{supplyUsage(steps, sup.id)} uses/day from your routine</span>}
              </label>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
          <input aria-label="New step" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStep()}
            placeholder="e.g. Vitamin C serum" style={{ ...input, flex: 1, minWidth: 180 }} />
          {Object.entries(WHEN_LABEL).map(([k, l]) => <button key={k} type="button" aria-pressed={when === k} onClick={() => setWhen(k)} style={pill(when === k)}>{l}</button>)}
          <button type="button" onClick={addStep} disabled={!name.trim()} style={{ ...primaryBtn, opacity: name.trim() ? 1 : 0.45 }}>Add step</button>
        </div>
        {importable.length > 0 && (
          <button type="button" onClick={importLegacy} style={{ ...pill(false), alignSelf: 'flex-start' }}>
            Import {importable.length} step{importable.length > 1 ? 's' : ''} from your written routine
          </button>
        )}
      </div>

      <div style={card}>
        <span style={label}>Face progress</span>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Same spot, same light, no filters. Compare your first photo with your latest.</div>
        <ProgressPhotos poses={['face']} legacy={false} />
      </div>

      {(legacy.morning || legacy.night) && (
        <details style={{ ...card, gap: 8 }}>
          <summary style={{ ...label, cursor: 'pointer' }}>Your written routine (kept)</summary>
          {['morning', 'night'].map(k => legacy[k] && (
            <div key={k}><span style={label}>{k}</span><pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-secondary)' }}>{legacy[k]}</pre></div>
          ))}
        </details>
      )}
    </div>
  );
}
