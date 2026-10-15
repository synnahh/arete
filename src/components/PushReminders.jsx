// PushReminders — daily push notifications at the times you choose (instead of paying for a phone number
// to send texts). Each reminder has its own time, days and wording; quiet hours hold anything back.
// The schedule is saved in settings (`settings.push`) and a server job (supabase/functions/push-send)
// sends what is due, so it arrives even when the app is closed. Setup: docs/push-setup.md.
import { useEffect, useState } from 'react';
import { updateSettings } from '../utils/settingsStore.js';
import { cleanPush, DEFAULT_PUSH, MAX_ITEMS } from '../domain/pushPrefs.js';
import { pushSupport, pushPermissionStatus, pushConfigured, requestPushPermission, isSubscribed, unsubscribePush, registerFCMToken, pushServerReady, sendTestPush } from '../utils/pushNotifications.js';
import { label } from './ui.js';

const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 14 };
const field = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 10, border: '0.5px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };
const btn = (primary) => ({ minHeight: 44, padding: '0 16px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: primary ? 700 : 500, border: primary ? 'none' : '0.5px solid var(--card-border)', background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--bg-base)' : 'var(--text-primary)' });
const dim = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCREENS = [['dashboard', 'Home'], ['workout', 'Train'], ['fuel', 'Fuel'], ['recover', 'Sleep'], ['body', 'Body'], ['lm', 'Look']];
const toast = (message, type = 'success') => window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));
const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_PUSH.tz; } catch { return DEFAULT_PUSH.tz; } };

// A text box that keeps what you type and saves when you leave it.
function Text({ value, onCommit, ...rest }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input {...rest} value={v} onChange={e => setV(e.target.value)} onBlur={() => v !== value && onCommit(v)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} style={field} />;
}

export default function PushReminders({ settings = {} }) {
  const push = cleanPush(settings.push);
  const [status, setStatus] = useState({ perm: pushPermissionStatus(), subscribed: false, server: null });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // id of the reminder whose wording is being edited
  const support = pushSupport();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [subscribed, server] = await Promise.all([isSubscribed(), push.enabled ? pushServerReady() : Promise.resolve(null)]);
      if (alive) setStatus({ perm: pushPermissionStatus(), subscribed, server });
      if (alive && push.enabled && subscribed) registerFCMToken(); // keep this device's subscription fresh
    })();
    return () => { alive = false; };
  }, [push.enabled]);

  const commit = (next) => updateSettings({ push: cleanPush({ ...push, ...next, tz: browserTz() }) });
  const setItem = (id, patch) => commit({ items: push.items.map(i => (i.id === id ? { ...i, ...patch } : i)) });

  async function turnOn() {
    setBusy(true);
    try {
      const result = await requestPushPermission();
      if (result === 'granted') { commit({ enabled: true }); toast('Reminders on for this device'); }
      else if (result === 'denied') toast('Notifications are blocked. Allow them for Arete in iPhone Settings > Notifications.', 'error');
      else if (result === 'no-vapid-key') toast('The app was built without a push key. See docs/push-setup.md step 3.', 'error');
      else toast(support.reason || 'Push is not available here.', 'error');
    } catch (err) { toast(err?.message || 'Could not turn push on.', 'error'); }
    finally { setBusy(false); setStatus(s => ({ ...s, perm: pushPermissionStatus() })); isSubscribed().then(v => setStatus(s => ({ ...s, subscribed: v }))); }
  }
  async function turnOff() { setBusy(true); await unsubscribePush(); commit({ enabled: false }); setBusy(false); setStatus(s => ({ ...s, subscribed: false })); }
  async function test() {
    setBusy(true);
    try {
      const r = await sendTestPush();
      toast(r?.sent > 0 ? 'Test sent. It should arrive in a few seconds.' : 'The server has no device to send to. Turn reminders off and on again.', r?.sent > 0 ? 'success' : 'error');
    } catch (err) { toast(err?.message || 'Test failed', 'error'); }
    finally { setBusy(false); }
  }
  function addItem() {
    if (push.items.length >= MAX_ITEMS) return;
    const id = `r${Date.now().toString(36)}`;
    commit({ items: [...push.items, { id, label: 'New reminder', time: '12:00', days: [0, 1, 2, 3, 4, 5, 6], on: true, title: 'Arete', body: 'Your reminder', tab: 'dashboard' }] });
    setOpen(id);
  }

  const on = push.enabled;
  const sorted = [...push.items].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <section aria-label="Reminders" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ ...label, flex: 1 }}>Reminders (push notifications)</div>
        <button type="button" role="switch" aria-checked={on} disabled={busy || (!on && !support.ok)} onClick={on ? turnOff : turnOn}
          style={{ ...btn(!on), minWidth: 96 }}>{busy ? '…' : on ? 'Turn off' : 'Turn on'}</button>
      </div>

      <div style={dim}>
        Short notifications at the times you pick, sent to this phone even when Arete is closed. No phone number or SMS needed.
      </div>
      {!support.ok && <div role="alert" style={{ ...dim, color: '#e8a13a' }}>{support.reason}</div>}
      {support.ok && !pushConfigured() && <div style={{ ...dim, color: '#e8a13a' }}>This build has no push key yet, so Turn on can't finish. See docs/push-setup.md.</div>}
      {on && status.server === false && <div role="alert" style={{ ...dim, color: '#e8a13a' }}>The server side isn't set up yet (or the push-send function isn't deployed), so nothing will be sent. Follow docs/push-setup.md, then press Send a test.</div>}
      {on && status.perm === 'denied' && <div role="alert" style={{ ...dim, color: '#e25d7a' }}>Notifications are blocked for Arete. Allow them in iPhone Settings > Notifications > Arete.</div>}
      {on && !status.subscribed && status.perm === 'granted' && <div style={dim}>This device isn't subscribed yet. Turn reminders off and on again.</div>}

      {on && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map(it => (
              <div key={it.id} style={{ padding: 12, borderRadius: 12, border: '0.5px solid var(--card-border)', background: it.on ? 'transparent' : 'var(--hover-bg)', display: 'flex', flexDirection: 'column', gap: 10, opacity: it.on ? 1 : 0.7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="time" value={it.time} aria-label={`${it.label} time`} onChange={e => e.target.value && setItem(it.id, { time: e.target.value })} style={{ ...field, width: 120, flexShrink: 0, textAlign: 'center' }} />
                  <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, minHeight: 44, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.body || 'No text'}</span>
                  </button>
                  <input type="checkbox" checked={it.on} aria-label={`${it.label} on`} onChange={e => setItem(it.id, { on: e.target.checked })} style={{ width: 26, height: 26, accentColor: 'var(--accent)', flexShrink: 0 }} />
                </div>
                <div role="group" aria-label={`${it.label} days`} style={{ display: 'flex', gap: 6 }}>
                  {DAY_LETTERS.map((l, d) => {
                    const sel = it.days.includes(d);
                    return <button key={d} type="button" aria-pressed={sel} aria-label={DAY_NAMES[d]} onClick={() => setItem(it.id, { days: sel ? it.days.filter(x => x !== d) : [...it.days, d] })}
                      style={{ flex: 1, minHeight: 40, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: sel ? 700 : 500, border: `1px solid ${sel ? 'var(--accent)' : 'var(--card-border)'}`, background: sel ? 'var(--active-bg)' : 'transparent', color: sel ? 'var(--accent)' : 'var(--text-muted)' }}>{l}</button>;
                  })}
                </div>
                {open === it.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Text aria-label="Title" placeholder="Title" maxLength={60} value={it.title} onCommit={v => setItem(it.id, { title: v, label: v || it.label })} />
                    <Text aria-label="Message" placeholder="Message" maxLength={160} value={it.body} onCommit={v => setItem(it.id, { body: v })} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Opens
                      <select value={it.tab} onChange={e => setItem(it.id, { tab: e.target.value })} style={{ ...field, flex: 1 }}>
                        {SCREENS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    </label>
                    <button type="button" style={{ ...btn(false), alignSelf: 'flex-start', color: '#e25d7a' }} onClick={() => commit({ items: push.items.filter(i => i.id !== it.id) })}>Delete this reminder</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn(false)} onClick={addItem} disabled={push.items.length >= MAX_ITEMS}>+ Add a reminder</button>
            <button type="button" style={btn(false)} onClick={test} disabled={busy}>Send a test</button>
          </div>

          <div style={{ borderTop: '0.5px solid var(--card-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer' }}>
              <input type="checkbox" checked={push.quiet.on} onChange={e => commit({ quiet: { ...push.quiet, on: e.target.checked } })} style={{ width: 24, height: 24, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>Quiet hours: hold back anything inside this window</span>
            </label>
            {push.quiet.on && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                From <input type="time" value={push.quiet.from} onChange={e => e.target.value && commit({ quiet: { ...push.quiet, from: e.target.value } })} style={{ ...field, width: 120 }} />
                to <input type="time" value={push.quiet.to} onChange={e => e.target.value && commit({ quiet: { ...push.quiet, to: e.target.value } })} style={{ ...field, width: 120 }} />
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Times use this phone's time zone ({push.tz}). Each reminder is sent once a day, within 10 minutes of its time.</div>
            <button type="button" style={{ ...btn(false), alignSelf: 'flex-start', minHeight: 40, fontSize: 13 }} onClick={() => { if (window.confirm('Reset all reminders to the standard set?')) commit({ items: DEFAULT_PUSH.items, quiet: DEFAULT_PUSH.quiet }); }}>Reset to the standard set</button>
          </div>
        </>
      )}
    </section>
  );
}
