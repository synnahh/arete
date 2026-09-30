// Log a meal with the AI: snap a photo or describe it (typed, or spoken where the
// browser supports speech). The AI estimates; you check and edit the numbers;
// only then does it go in the log, marked as an estimate and carrying its
// ingredients so the pantry follows. Needs the ai-chat gateway (see
// supabase/functions). Parsing and safety: src/domain/mealScan.js.
import { useRef, useState } from 'react';
import { imageForAI } from '../utils/photoStore.js';
import { askClaudeRaw } from '../utils/claudeRaw.js';
import { MEAL_SCAN_PROMPT, MEAL_TEXT_PROMPT, parseMealEstimate, entryFromEstimate } from '../domain/mealScan.js';

const field = { height: 44, minWidth: 0, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)' };
const btn = (primary) => ({
  minHeight: 44, padding: '0 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 600 : 500, WebkitTapHighlightColor: 'transparent',
  border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--tab-accent)' : 'var(--hover-bg)', color: primary ? 'var(--on-tab-accent)' : 'var(--text-primary)',
});
const CONF = { low: '#e25d7a', medium: '#e8a13a', high: '#4caf7d' };
const speechCtor = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
const MAX_TEXT = 500;

export default function MealAI({ onLog }) {
  const fileRef = useRef(null);
  const recRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | describing | working | review | error
  const [message, setMessage] = useState('');
  const [text, setText] = useState('');
  const [spoken, setSpoken] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState(null);

  async function estimate(run, source) {
    setPhase('working'); setMessage('');
    try {
      const parsed = parseMealEstimate(await run());
      if (!parsed.ok) { setPhase('error'); setMessage(parsed.reason); return; }
      setDraft({ ...parsed.estimate, source }); setPhase('review');
    } catch (err) {
      setPhase('error'); setMessage(err?.message || 'Could not reach the AI. Log it by hand or try again.');
    }
  }

  function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    estimate(async () => {
      const image = await imageForAI(file);
      return askClaudeRaw('Estimate the nutrition of the meal in this photo.', MEAL_SCAN_PROMPT, [], { image, maxTokens: 700 });
    }, 'photo');
  }

  function describe() {
    const t = text.trim().slice(0, MAX_TEXT);
    if (!t) { setMessage('Say or type what you ate first.'); return; }
    estimate(() => askClaudeRaw(t, MEAL_TEXT_PROMPT, [], { maxTokens: 700 }), spoken ? 'voice' : 'text');
  }

  function listen() {
    const SR = speechCtor();
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = navigator.language || 'en-AU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => { const t = ev.results?.[0]?.[0]?.transcript; if (t) { setText(prev => (prev ? prev + ' ' : '') + t); setSpoken(true); } };
    rec.onend = () => setListening(false);
    rec.onerror = (ev) => { setListening(false); setMessage(ev?.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Could not hear that. Try again or type it.'); };
    recRef.current = rec;
    setMessage(''); setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  async function log() {
    const entry = entryFromEstimate({ ...draft, calories: Number(draft.calories), protein: Number(draft.protein), carbs: Number(draft.carbs), fat: Number(draft.fat) });
    if (!entry) { setMessage('Enter calories between 1 and 10,000.'); return; }
    await onLog(entry);
    setDraft(null); setText(''); setSpoken(false); setMessage(''); setPhase('idle');
  }
  const discard = () => { setDraft(null); setMessage(''); setPhase(text ? 'describing' : 'idle'); };
  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e.target.value }));
  const working = phase === 'working';

  return (
    <div style={{ display: 'contents' }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhoto} aria-label="Meal photo" />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={working} style={btn(false)}>{working ? 'Estimating…' : 'Photo'}</button>
      <button type="button" aria-pressed={phase === 'describing'} onClick={() => setPhase(p => (p === 'describing' ? 'idle' : 'describing'))} disabled={working} style={btn(false)}>Describe</button>

      {phase === 'describing' && (
        <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
          <textarea aria-label="What did you eat?" rows={2} maxLength={MAX_TEXT} value={text} onChange={e => { setText(e.target.value); setSpoken(false); }}
            placeholder="e.g. two eggs on toast and a flat white" style={{ ...field, height: 'auto', padding: 10, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {speechCtor() && <button type="button" onClick={listen} aria-pressed={listening} style={btn(false)}>{listening ? 'Listening… tap to stop' : 'Speak'}</button>}
            <button type="button" onClick={describe} style={btn(true)}>Estimate</button>
          </div>
        </div>
      )}

      {message && phase !== 'review' && <div role="alert" style={{ flexBasis: '100%', fontSize: 12.5, color: '#e25d7a' }}>{message}</div>}

      {phase === 'review' && draft && (
        <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            AI estimate from your {draft.source === 'photo' ? 'photo' : draft.source === 'voice' ? 'voice note' : 'description'}, <strong style={{ color: CONF[draft.confidence] }}>{draft.confidence} confidence</strong>. Check the numbers before you log.
          </div>
          {draft.items.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{draft.items.join(' · ')}</div>}
          {draft.ingredients.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Also updates your pantry: {draft.ingredients.map(i => `${i.qty}${i.unit ? ' ' + i.unit : ''} ${i.name}`).join(', ')}.</div>}
          {draft.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{draft.note}</div>}
          <input aria-label="Meal name" value={draft.name} onChange={set('name')} style={field} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[['calories', 'kcal'], ['protein', 'protein g'], ['carbs', 'carbs g'], ['fat', 'fat g']].map(([k, ph]) => (
              <input key={k} aria-label={ph} inputMode="decimal" placeholder={ph} value={draft[k]} onChange={set(k)} style={{ ...field, flex: 1, width: 0 }} />
            ))}
          </div>
          {message && <div role="alert" style={{ fontSize: 12.5, color: '#e25d7a' }}>{message}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={log} style={btn(true)}>Log it</button>
            <button type="button" onClick={discard} style={btn(false)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
