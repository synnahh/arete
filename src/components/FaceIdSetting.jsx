// FaceIdSetting — turn Face ID (or Touch ID / Windows Hello) on or off for the PIN gate, any time.
// The gate offers it once after a correct PIN; this is the way back if you said "Not now".
// The key lives on this device and this web address only, so each device (and a new site address)
// is set up on its own. Rules: utils/faceId.js.
import { useEffect, useState } from 'react';
import { biometricAvailable, biometricLabel, faceIdEnabled, enableFaceIdDetailed, forgetFaceId, unlockWithFaceId } from '../utils/faceId.js';

const btn = { minHeight: 44, padding: '0 18px', borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' };

export default function FaceIdSetting() {
  const label = biometricLabel();
  const [available, setAvailable] = useState(null);
  const [on, setOn] = useState(faceIdEnabled());
  const [note, setNote] = useState('');

  useEffect(() => { biometricAvailable().then(setAvailable); }, []);

  const turnOn = async () => {
    setNote('');
    const r = await enableFaceIdDetailed();
    setOn(r.ok);
    setNote(r.ok ? `${label} is on. The PIN screen will ask for it when the app opens.` : r.error);
  };
  const turnOff = () => { forgetFaceId(); setOn(false); setNote(`${label} is off. The PIN still works.`); };
  const test = async () => { setNote((await unlockWithFaceId()) ? `${label} worked.` : `${label} did not verify.`); };

  return (
    <div style={{ marginBottom: 28, padding: '18px 20px', borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'var(--hover-bg)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {label} {on && <span style={{ fontSize: 11, color: '#4caf7d', marginLeft: 6, fontWeight: 400 }}>● On</span>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.55 }}>
        {available === false
          ? `This device or browser has no ${label} available. On an iPhone, open the app from the Home Screen icon, with Face ID set up in iOS Settings.`
          : `Opens the app with ${label} instead of typing the PIN. The key stays on this device only, so turn it on separately on each device. The PIN remains the backup.`}
      </div>
      {available !== false && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {on
            ? (<><button type="button" onClick={test} style={btn}>Test it</button><button type="button" onClick={turnOff} style={btn}>Turn off</button></>)
            : <button type="button" onClick={turnOn} disabled={available == null} style={btn}>Turn on {label}</button>}
        </div>
      )}
      {note && <div role="status" style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10 }}>{note}</div>}
    </div>
  );
}
