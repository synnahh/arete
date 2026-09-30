// Skin photo analysis: take or pick a face photo and the AI describes what it can
// see (oiliness, spots, redness, texture, dryness), scores it on the same 0-10
// scale as the monthly assessment, and suggests small routine changes. Nothing is
// saved until you tap Save. The photo is shrunk, sent to the AI service for this
// one read and not stored (use Face photos below to keep progress pictures).
// Parsing and safety rules: src/domain/skinAnalysis.js. Not medical advice.
import { useRef, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { imageForAI } from '../utils/photoStore.js';
import { askClaudeRaw } from '../utils/claudeRaw.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { SKIN_METRICS, SKIN_SCAN_PROMPT, parseSkinAnalysis, scanContext, compareAssessments, assessmentRow } from '../domain/skinAnalysis.js';

const label = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' };
const btn = (primary) => ({
  minHeight: 44, padding: '0 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 600 : 500, WebkitTapHighlightColor: 'transparent',
  border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--tab-accent)' : 'transparent', color: primary ? 'var(--on-tab-accent)' : 'var(--text-primary)',
});
const CONF = { low: '#e25d7a', medium: '#e8a13a', high: '#4caf7d' };
const barColour = (v) => (v <= 3 ? '#4caf7d' : v <= 6 ? '#e8a13a' : '#e25d7a');

export default function SkinScan({ steps = [], skinProfile = {} }) {
  const skin = useCollection('lm_skin', 'valerie_lm_skin');
  const fileRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | working | review | error
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const today = toLocalDateKey(new Date());
  const previous = [...skin.items].filter(r => r?.date && r.date < today).sort((a, b) => a.date.localeCompare(b.date)).pop() || null;
  const change = result && previous ? compareAssessments(previous, result.scores) : null;

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhase('working'); setMessage(''); setResult(null);
    try {
      const image = await imageForAI(file);
      const parsed = parseSkinAnalysis(await askClaudeRaw(scanContext(steps, skinProfile), SKIN_SCAN_PROMPT, [], { image, maxTokens: 800 }));
      if (!parsed.ok) { setPhase('error'); setMessage(parsed.reason); return; }
      setResult(parsed.analysis); setPhase('review');
    } catch (err) {
      setPhase('error'); setMessage(err?.message || 'Could not reach the AI. Try again in a moment.');
    }
  }

  async function save() {
    if (saving || !result) return;
    setSaving(true);
    try {
      await skin.add(assessmentRow(result, today));
      window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message: 'Saved as today\'s skin assessment.', type: 'success' } }));
      setResult(null); setPhase('idle');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={label}>Skin photo analysis</span>
      <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={onPhoto} aria-label="Face photo" />
      {phase !== 'review' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Take a photo in even daylight, no filter, no makeup. The AI describes what it can see and suggests small routine changes. It is a guide from one photo, not a diagnosis. The photo is sent to the AI service to be read and is not kept.
          </div>
          <div><button type="button" onClick={() => fileRef.current?.click()} disabled={phase === 'working'} style={btn(true)}>{phase === 'working' ? 'Looking…' : 'Analyse a photo'}</button></div>
        </>
      )}
      {message && phase === 'error' && <div role="alert" style={{ fontSize: 12.5, color: '#e25d7a' }}>{message}</div>}

      {phase === 'review' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Read from your photo, <strong style={{ color: CONF[result.confidence] }}>{result.confidence} confidence</strong>. Overall <strong className="val-num" style={{ color: 'var(--text-primary)' }}>{result.score}/10</strong> (10 = clearest){result.oiliness !== 'unclear' ? `, looks ${result.oiliness}` : ''}.
          </div>

          {result.seeProfessional && (
            <div role="alert" style={{ padding: 12, borderRadius: 12, fontSize: 13, lineHeight: 1.45, color: 'var(--text-primary)', background: 'color-mix(in srgb, #e25d7a 14%, transparent)', border: '0.5px solid #e25d7a' }}>
              <strong>Worth showing a doctor or dermatologist.</strong>{result.professionalReason ? ` ${result.professionalReason}` : ''}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SKIN_METRICS.map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 96, textTransform: 'capitalize', color: 'var(--text-primary)' }}>{k}</span>
                <span aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${result.scores[k] * 10}%`, background: barColour(result.scores[k]) }} />
                </span>
                <span className="val-num" style={{ width: 44, textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {result.scores[k]}{change && change.changes[k] ? ` (${change.changes[k] > 0 ? '+' : ''}${change.changes[k]})` : ''}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>0 = clear, 10 = severe{change ? `. Change since ${previous.date} in brackets, lower is better.` : '.'}</div>
          </div>

          {result.observations.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {result.observations.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          )}
          {result.suggestions.length > 0 && (
            <div>
              <div style={{ ...label, marginBottom: 4 }}>Try</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                {result.suggestions.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          {result.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.note}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={save} disabled={saving} style={btn(true)}>Save as today's assessment</button>
            <button type="button" onClick={() => { setResult(null); setPhase('idle'); }} style={btn(false)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
