// HealthSetupGuide — step by step: Eufy scale and Fitbit Air -> Apple Health -> Health Auto Export
// -> Arete. Lives on Profile above the Sync check, which says whether the data has arrived.
// The sync token is never shown or stored here; it is only ever pasted into Health Auto Export.
// Longer version for the computer side: docs/health-ingest-checklist.md.
import { useState } from 'react';
import { label } from './ui.js';

const KEY = 'arete_health_guide_done';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: ticks last for this visit only */ } };

const BASE = String(import.meta.env?.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ENDPOINT = BASE ? `${BASE}/functions/v1/health-ingest` : 'https://<your-project>.supabase.co/functions/v1/health-ingest';

const PARTS = [
  {
    title: 'How it fits together',
    intro: "Your scale and your Fitbit Air each hand their readings to Apple Health. A small app called Health Auto Export then posts them to your own Arete database, and Arete reads them from there. Nothing goes through anyone else's server.",
    diagram: ['Eufy scale > EufyLife > Apple Health', 'Fitbit Air > Google Health > Apple Health', 'Apple Health > Health Auto Export > Arete'].join('\n'),
    note: "Use Google Health, not Bevel, for the Fitbit Air. Bevel only reads Apple Health to show its own scores; it can't send anything to Arete.",
    steps: [],
  },
  {
    title: 'A. Once, on your computer (the Arete server)',
    intro: "The database table, a secret token and the receiving function. These need your accounts, so you do them once yourself; the app can't.",
    steps: [
      ['a1', 'Open PowerShell in the Arete project folder and run the setup script.', 'Command: .\\scripts\\setup-health-sync.ps1\nIt creates the table, makes a token, stores it as a secret, deploys the function and tests it. It puts the token on your clipboard.'],
      ['a2', 'Paste the token into Health Auto Export (part C) BEFORE you press Enter at the end of the script.', "Each run makes a NEW token and kills the old one, so don't run it again unless you have to. Never paste the token into chat or notes."],
      ['a3', 'To test a token later without changing anything, run the script with -Check.', 'Command: .\\scripts\\setup-health-sync.ps1 -Check\nPaste the token from the phone; it says ACCEPTED or REFUSED.'],
    ],
  },
  {
    title: 'B. On the iPhone: get the readings into Apple Health',
    intro: 'Two apps write to Apple Health. Set up both, then check Apple Health shows the data.',
    steps: [
      ['b1', 'EufyLife (scale): turn on Apple Health sharing.', 'EufyLife > Settings > Apple Health. Allow Weight and Body Fat. Step on the scale once and open EufyLife so it writes.'],
      ['b2', 'Google Health (Fitbit Air): update to version 5.05 or later and connect the Fitbit Air.', 'Use the same Google account the Fitbit uses.'],
      ['b3', 'Google Health: send data to Apple Health.', "Profile > Apps and services (or Partner apps) > Apple Health. Allow Steps, Heart Rate, Sleep, Exercise and Distance. Google doesn't pass heart rate variability on, so it won't appear."],
      ['b4', 'Check it landed: open the Health app > Browse and look for Weight, Steps and Sleep with recent entries.', "If they're missing here, fix this part first. Arete can only pass on what Apple Health has."],
      ['b5', 'Avoid double-counted steps: Health > Browse > Activity > Steps > Data Sources & Access > Edit, and drag Google Health above iPhone.', 'Then the Fitbit wins when both record the same minute.'],
    ],
  },
  {
    title: 'C. On the iPhone: Health Auto Export (the courier)',
    intro: 'Install Health Auto Export. Its background automations need the paid Premium plan; check the price in the app before buying.',
    steps: [
      ['c1', 'Automations > New > REST API.', `URL: ${ENDPOINT}\nMethod: POST. Format: JSON.`],
      ['c2', 'Add one header: name x-health-token, value = your token from part A.', 'Paste it with no spaces before or after. A trailing space causes a 401.'],
      ['c3', 'Choose the metrics: Step Count, Active Energy, Heart Rate, Resting Heart Rate, Heart Rate Variability, Respiratory Rate, Blood Oxygen Saturation, Weight and Body Mass, Body Fat Percentage, Sleep Analysis.', 'Any other metric you add is stored too and shows as an extra tile on Home > Metrics.'],
      ['c4', 'Date range: the last 7 days. Summarize data: on. Sync interval: as short as it offers.', 'Overlap is safe: Arete ignores anything it already has, and a missed run is repaired by the next one.'],
      ['c5', 'Run the automation once by hand with the phone unlocked.', "It should report success. If not, see \"If it doesn't arrive\" below."],
      ['c6', 'Let iOS run it in the background.', "iOS Settings > General > Background App Refresh: on for Health Auto Export, EufyLife and Google Health. Turn Low Power Mode off. Add the Health Auto Export widget to the Home Screen; it is the best prompt iOS gives the app to run, and shows the last run. iOS never reads Health on a locked phone, so syncing happens when the phone has been unlocked recently."],
    ],
  },
  {
    title: 'D. Check it in Arete',
    intro: 'The Sync check card just below this guide shows whether health data has arrived.',
    steps: [
      ['d1', 'Profile > Sync check: the Health line should say "arrived today" with your steps.', ''],
      ['d2', 'Step on the scale. Within the hour (phone unlocked at some point) the weigh-in with body fat shows in Progress > Body, with no typing.', ''],
      ['d3', 'Next morning: Progress > Sleep shows last night from the Fitbit Air, and Home > Metrics fills in.', ''],
    ],
  },
];

const TROUBLE = [
  ['401 from Health Auto Export', "The token on the phone isn't the deployed one. Run the script with -Check, or do one final run and paste the new token before pressing Enter."],
  ['503', 'A server secret is missing. Re-run the setup script.'],
  ['404', "The function isn't deployed. Re-run the setup script."],
  ['200 but nothing shows', 'Metrics not selected, or the date range had no data. Check C3 and C4.'],
  ['Weighed in, nothing in Arete', "EufyLife hasn't written to Apple Health yet. Open EufyLife once and check Health > Sharing."],
  ['Fitbit data missing', "Google Health isn't connected to Apple Health, or is older than 5.05 (B2, B3)."],
  ['Worked, then stopped', "iOS didn't get a chance to run it. Check C6 and open the widget."],
];

export default function HealthSetupGuide() {
  const [done, setDone] = useState(read);
  const total = PARTS.reduce((n, p) => n + p.steps.length, 0);
  const ticked = PARTS.reduce((n, p) => n + p.steps.filter(([id]) => done.includes(id)).length, 0);

  const toggle = (id) => setDone(prev => { const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; write(next); return next; });

  return (
    <details style={{ padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)' }}>
      <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ ...label, flex: 1 }}>Health sync setup guide</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{ticked}/{total} done</span>
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 14 }}>
        {PARTS.map(p => (
          <section key={p.title} aria-label={p.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.intro}</div>
            {p.diagram && <pre style={{ margin: 0, padding: 10, borderRadius: 10, background: 'var(--hover-bg)', fontSize: 12, lineHeight: 1.5, overflowX: 'auto', color: 'var(--text-primary)', userSelect: 'text' }}>{p.diagram}</pre>}
            {p.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.note}</div>}
            {p.steps.map(([id, text, detail]) => (
              <label key={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox" checked={done.includes(id)} onChange={() => toggle(id)} style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0, accentColor: 'var(--accent)' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.45, textDecoration: done.includes(id) ? 'line-through' : 'none', opacity: done.includes(id) ? 0.6 : 1 }}>{text}</span>
                  {detail && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text' }}>{detail}</span>}
                </span>
              </label>
            ))}
          </section>
        ))}
        <section aria-label="If it doesn't arrive" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>If it doesn't arrive</div>
          {TROUBLE.map(([what, fix]) => (
            <div key={what} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}><b style={{ color: 'var(--text-primary)' }}>{what}.</b> {fix}</div>
          ))}
        </section>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Your token is a password: it lives in your Supabase secrets and in Health Auto Export, nowhere else. Full computer-side steps: docs/health-ingest-checklist.md.</div>
      </div>
    </details>
  );
}
