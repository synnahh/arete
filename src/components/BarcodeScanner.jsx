// BarcodeScanner — a full-screen scanner for food, skincare and supplements. Dark camera view,
// a back arrow and a centred title, corner brackets round the target and a glowing line that
// sweeps through it. One shared screen so every scan in the app looks and behaves the same.
//
//   <BarcodeScanner title="Scan Barcode" onClose={...} onCode={async (code) => 'message' | undefined} />
//
// onCode runs once per code read. Return nothing to say "handled" (the caller then closes the
// scanner), or return a message (string, or a promise of one) to show it and keep scanning.
// Camera permission, the frame loop and the 30 s camera keep-alive live in utils/openFoodFacts.js.
// No camera, or camera blocked: the photo button (the phone's own camera sheet, no permission)
// and typing the number still work.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { startBarcodeScan, canScanBarcodes, decodeBarcodeFromFile, cameraTrack } from '../utils/openFoodFacts.js';
import { isBarcode } from '../utils/openBeautyFacts.js';
import { haptic, useReducedMotion } from './Motion.jsx';

const BEAM = '#22d3ee';
const OK = '#4ade80';

const Corner = ({ at, colour }) => {
  const v = at.startsWith('t') ? { top: 0, borderTop: `3px solid ${colour}` } : { bottom: 0, borderBottom: `3px solid ${colour}` };
  const h = at.endsWith('l') ? { left: 0, borderLeft: `3px solid ${colour}` } : { right: 0, borderRight: `3px solid ${colour}` };
  const r = { tl: '10px 0 0 0', tr: '0 10px 0 0', bl: '0 0 0 10px', br: '0 0 10px 0' }[at];
  return <span aria-hidden="true" style={{ position: 'absolute', width: 30, height: 30, borderRadius: r, transition: 'border-color var(--dur-1) var(--ease-out)', ...v, ...h }} />;
};

export default function BarcodeScanner({ title = 'Scan Barcode', hint = 'Hold the barcode inside the frame, steady and well lit.', onClose, onCode }) {
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const photoRef = useRef(null);
  const alive = useRef(true);
  // Refs, so a parent re-render never restarts the camera.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reduced = useReducedMotion();

  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);
  const [hit, setHit] = useState(false);
  const [torch, setTorch] = useState({ can: false, on: false });
  const [typing, setTyping] = useState(false);
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);

  const begin = useCallback(() => {
    if (!canScanBarcodes()) { setError(true); setMsg('This browser cannot open the camera. Take a photo or type the number.'); return; }
    stopRef.current?.();
    stopRef.current = startBarcodeScan(videoRef.current, {
      onDetect: (code) => { stopRef.current = null; handle(code); },
      onError: (e) => { setError(true); setMsg(e?.name === 'NotAllowedError' ? 'The camera is blocked for this app. Take a photo or type the number instead.' : (e?.message || 'Could not open the camera. Take a photo or type the number.')); },
    });
    // The torch exists only on some phones (Android Chrome); iPhone web apps cannot switch it on.
    setTimeout(() => { const caps = cameraTrack()?.getCapabilities?.(); if (alive.current && caps?.torch) setTorch(t => ({ ...t, can: true })); }, 800);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A code was read (by camera, photo or typing): flash the frame, then hand it over.
  async function handle(code) {
    if (!alive.current) return;
    setHit(true); setBusy(true); setError(false); setMsg('Found it…');
    haptic([14, 30, 14]);
    await new Promise(r => setTimeout(r, reduced ? 0 : 260));
    let problem;
    try { problem = await onCodeRef.current?.(code); } catch (e) { problem = e?.message || 'Something went wrong. Try again.'; }
    if (!alive.current) return;
    setHit(false); setBusy(false);
    if (typeof problem === 'string' && problem) { setError(true); setMsg(problem); setTimeout(() => { if (alive.current) begin(); }, 900); }
  }

  useEffect(() => {
    alive.current = true;
    const t = setTimeout(begin, 60);   // the <video> must exist first
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      alive.current = false; clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      stopRef.current?.(); stopRef.current = null;
    };
  }, [begin]);

  const flip = async () => {
    const track = cameraTrack();
    if (!track) return;
    const next = !torch.on;
    try { await track.applyConstraints({ advanced: [{ torch: next }] }); setTorch({ can: true, on: next }); } catch { setTorch({ can: false, on: false }); }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stopRef.current?.(); stopRef.current = null;
    setError(false); setMsg('Reading the barcode…'); setBusy(true);
    try { await handle(await decodeBarcodeFromFile(file)); }
    catch { setBusy(false); setError(true); setMsg('Could not read a barcode from that photo. Try again closer, or type the number.'); begin(); }
  };

  const submitDigits = (e) => {
    e.preventDefault();
    if (!isBarcode(digits)) { setError(true); setMsg('Barcodes are 6 to 14 numbers, printed under the bars.'); return; }
    stopRef.current?.(); stopRef.current = null;
    handle(digits.trim());
  };

  const colour = hit ? OK : BEAM;
  const FRAME = 'min(78vw, 320px)';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="scan-screen">
      <video ref={videoRef} muted playsInline aria-hidden="true" className="scan-video" />

      <header className="scan-top">
        <button type="button" onClick={onClose} aria-label="Back" className="scan-back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h2 className="scan-title">{title}</h2>
        <span style={{ width: 44 }} aria-hidden="true" />
      </header>

      <div className="scan-stage">
        <div className="scan-frame" style={{ width: FRAME, height: FRAME }}>
          <Corner at="tl" colour={hit ? OK : '#fff'} /><Corner at="tr" colour={hit ? OK : '#fff'} />
          <Corner at="bl" colour={hit ? OK : '#fff'} /><Corner at="br" colour={hit ? OK : '#fff'} />
          <span aria-hidden="true" className={`scan-beam${reduced || hit ? ' is-still' : ''}`}
            style={{ background: `linear-gradient(90deg, transparent, ${colour} 14%, #ecfeff 50%, ${colour} 86%, transparent)`, boxShadow: `0 0 14px 3px ${colour}99, 0 0 36px 8px ${colour}44` }} />
        </div>
      </div>

      <footer className="scan-bottom">
        <div role="status" aria-live="polite" className="scan-msg" style={{ color: error ? '#fbbf24' : 'rgba(255,255,255,0.78)' }}>{msg || hint}</div>

        {typing && (
          <form onSubmit={submitDigits} className="scan-type">
            <input value={digits} onChange={e => setDigits(e.target.value.replace(/\D/g, '').slice(0, 14))} inputMode="numeric" autoComplete="off" placeholder="Barcode number" aria-label="Barcode number" autoFocus />
            <button type="submit" disabled={busy}>Look up</button>
          </form>
        )}

        <div className="scan-actions">
          {torch.can && <button type="button" onClick={flip} aria-pressed={torch.on}>{torch.on ? 'Torch on' : 'Torch'}</button>}
          <button type="button" onClick={() => photoRef.current?.click()}>Take a photo</button>
          <button type="button" onClick={() => setTyping(t => !t)} aria-pressed={typing}>Type the number</button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} aria-label="Barcode photo" style={{ display: 'none' }} />
      </footer>
    </div>,
    document.body,
  );
}
