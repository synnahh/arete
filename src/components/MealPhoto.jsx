// Log a meal from a photo: the AI estimates it, you check and edit the numbers,
// then it goes in the log. Nothing is logged without your tap, and the entry is
// marked as an estimate. Needs the ai-chat gateway (see supabase/functions).
import { useRef, useState } from 'react';
import { imageForAI } from '../utils/photoStore.js';
import { askClaudeRaw } from '../utils/claudeRaw.js';
import { MEAL_SCAN_PROMPT, parseMealEstimate, entryFromEstimate } from '../domain/mealScan.js';

const field = { height: 44, minWidth: 0, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)' };
const btn = (primary) => ({
  minHeight: 44, padding: '0 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 600 : 500, WebkitTapHighlightColor: 'transparent',
  border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--tab-accent)' : 'var(--hover-bg)', color: primary ? 'var(--on-tab-accent)' : 'var(--text-primary)',
});
const CONF = { low: '#e25d7a', medium: '#e8a13a', high: '#4caf7d' };

export default function MealPhoto({ onLog }) {
  const fileRef = useRef(null);
  const [state, setState] = useState({ phase: 'idle' }); // idle | working | review | error
  const [draft, setDraft] = useState(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState({ phase: 'working' });
    try {
      const image = await imageForAI(file);
      const reply = await askClaudeRaw('Estimate the nutrition of the meal in this photo.', MEAL_SCAN_PROMPT, [], { image, maxTokens: 600 });
      const parsed = parseMealEstimate(reply);
      if (!parsed.ok) { setState({ phase: 'error', message: parsed.reason }); return; }
      setDraft({ ...parsed.estimate }); setState({ phase: 'review' });
    } catch (err) {
      setState({ phase: 'error', message: err?.message || 'Could not reach the AI. Log it by hand or try again.' });
    }
  }

  async function log() {
    const entry = entryFromEstimate({ ...draft, calories: Number(draft.calories), protein: Number(draft.protein), carbs: Number(draft.carbs), fat: Number(draft.fat) });
    if (!entry) { setState({ phase: 'review', message: 'Enter calories between 1 and 10,000.' }); return; }
    await onLog(entry);
    setDraft(null); setState({ phase: 'idle' });
  }

  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e.target.value }));

  return (
    <div style={{ display: 'contents' }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pick} aria-label="Meal photo" />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={state.phase === 'working'} style={btn(false)}>
        {state.phase === 'working' ? 'Estimating…' : 'Photo'}
      </button>
      {state.phase === 'error' && <div role="alert" style={{ flexBasis: '100%', fontSize: 12.5, color: '#e25d7a' }}>{state.message}</div>}
      {state.phase === 'review' && draft && (
        <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            AI estimate from your photo, <strong style={{ color: CONF[draft.confidence] }}>{draft.confidence} confidence</strong>. Check the numbers before you log.
          </div>
          {draft.items.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{draft.items.join(' · ')}</div>}
          {draft.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{draft.note}</div>}
          <input aria-label="Meal name" value={draft.name} onChange={set('name')} style={field} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[['calories', 'kcal'], ['protein', 'protein g'], ['carbs', 'carbs g'], ['fat', 'fat g']].map(([k, ph]) => (
              <input key={k} aria-label={ph} inputMode="decimal" placeholder={ph} value={draft[k]} onChange={set(k)} style={{ ...field, flex: 1, width: 0 }} />
            ))}
          </div>
          {state.message && <div role="alert" style={{ fontSize: 12.5, color: '#e25d7a' }}>{state.message}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={log} style={btn(true)}>Log it</button>
            <button type="button" onClick={() => { setDraft(null); setState({ phase: 'idle' }); }} style={btn(false)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
