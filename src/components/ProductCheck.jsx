// Check a skincare product before it goes in your routine: scan or type its
// barcode (Open Beauty Facts), or paste its ingredients. Shows the actives it
// contains and what it would clash with in your current routine, then lets you
// add it. Rules: checkProduct() in domain/skin.js. General guidance only.
import { useRef, useState } from 'react';
import { checkProduct, TAG_LABELS } from '../domain/skin.js';
import { isBarcode, lookupBeautyProduct } from '../utils/openBeautyFacts.js';
import { startBarcodeScan } from '../utils/openFoodFacts.js';

const label = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)' };
const input = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 10, background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14 };
const btn = (primary) => ({
  minHeight: 44, padding: '0 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 600 : 500, WebkitTapHighlightColor: 'transparent',
  border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--tab-accent)' : 'transparent', color: primary ? 'var(--on-tab-accent)' : 'var(--text-primary)',
});
const VERDICT = {
  ok:   { colour: '#4caf7d', text: 'No clashes with your current routine.' },
  tip:  { colour: '#e8a13a', text: 'Worth a look before you add it.' },
  warn: { colour: '#e25d7a', text: 'Would clash with part of your routine.' },
};

export default function ProductCheck({ steps, onAdd }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [pao, setPao] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [track, setTrack] = useState(true);
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const canScan = typeof window !== 'undefined' && !!window.BarcodeDetector;

  const result = name.trim() || ingredients.trim() ? checkProduct({ name, ingredients }, steps) : null;

  async function lookup(c = code) {
    setStatus(''); setBusy(true);
    try {
      const p = await lookupBeautyProduct(c);
      setName([p.brand, p.name].filter(Boolean).join(' ').slice(0, 80)); setIngredients(p.ingredients); setPao(p.paoMonths);
      setStatus(p.ingredients ? 'Found it. Check the ingredients look right.' : 'Found the product but it has no ingredient list. Paste the ingredients from the label.');
    } catch (e) { setStatus(e.message || 'Lookup failed.'); }
    finally { setBusy(false); }
  }

  function stopScan() { stopRef.current?.(); stopRef.current = null; setScanning(false); }
  function scan() {
    setStatus(''); setScanning(true);
    stopRef.current = startBarcodeScan(videoRef.current, {
      onDetect: (c) => { stopScan(); setCode(c); lookup(c); },
      onError: (e) => { setScanning(false); setStatus(e.message || 'Could not start the camera. Type the barcode instead.'); },
    });
  }

  async function add(when) {
    if (!name.trim()) { setStatus('Give the product a name first.'); return; }
    setBusy(true);
    try {
      await onAdd({ name: name.trim(), when, paoMonths: pao, track });
      setName(''); setIngredients(''); setCode(''); setPao(null); setStatus('Added to your routine.');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" aria-expanded={open} onClick={() => { setOpen(o => !o); if (open) stopScan(); }}
        style={{ ...label, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: 32 }}>
        Check a product {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="Barcode number" inputMode="numeric" placeholder="Barcode number" value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && isBarcode(code)) lookup(); }} style={{ ...input, flex: 1, minWidth: 160 }} />
            <button type="button" onClick={() => lookup()} disabled={busy || !isBarcode(code)} style={{ ...btn(false), opacity: isBarcode(code) ? 1 : 0.5 }}>Look up</button>
            {canScan && <button type="button" onClick={scanning ? stopScan : scan} style={btn(false)}>{scanning ? 'Stop' : 'Scan'}</button>}
          </div>
          {scanning && <video ref={videoRef} muted playsInline aria-label="Camera preview" style={{ width: '100%', maxHeight: 220, borderRadius: 12, background: '#000', objectFit: 'cover' }} />}
          <input aria-label="Product name" placeholder="Product name" value={name} onChange={e => setName(e.target.value)} style={input} />
          <textarea aria-label="Ingredients" placeholder="Paste the ingredients from the label (INCI list)" rows={3} value={ingredients}
            onChange={e => setIngredients(e.target.value)} style={{ ...input, padding: 12, resize: 'vertical' }} />
          {status && <div role="status" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{status}</div>}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                {result.tags.length ? `Contains ${result.tags.map(t => TAG_LABELS[t] || t).join(', ')}.` : 'No common actives (retinoid, acids, vitamin C, benzoyl peroxide) spotted.'}
              </div>
              <div role="status" style={{ fontSize: 13.5, fontWeight: 600, color: VERDICT[result.verdict].colour }}>{VERDICT[result.verdict].text}</div>
              {[['Morning', result.am], ['Night', result.pm]].map(([when, list]) => list.map(w => (
                <div key={when + w.text} style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-primary)' }}>
                  <span style={{ color: w.level === 'warn' ? '#e25d7a' : '#e8a13a', fontWeight: 600 }}>{when}: </span>{w.text}
                </div>
              )))}
              {!ingredients.trim() && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Without the ingredient list only the product name is checked.</div>}
            </div>
          )}

          {(name.trim() || ingredients.trim()) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={track} onChange={e => setTrack(e.target.checked)} style={{ accentColor: 'var(--tab-accent)' }} />
                Also track it in Supplies{pao ? ` (use within ${pao} months of opening)` : ''}
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => add('am')} style={btn(false)}>Add to morning</button>
                <button type="button" disabled={busy} onClick={() => add('pm')} style={btn(false)}>Add to night</button>
                <button type="button" disabled={busy} onClick={() => add('both')} style={btn(true)}>Add to both</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
