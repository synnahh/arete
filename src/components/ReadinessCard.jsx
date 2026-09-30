// Readiness: one number for how ready you are to train today, why, and the
// sleep debt behind it. Advice only: it never changes a plan. Rules and
// thresholds: src/domain/recovery.js.
import { useRecovery } from '../hooks/useRecovery.js';
import { updateSettings } from '../utils/settingsStore.js';
import { label } from './ui.js';

const BAND_COLOUR = { push: '#4caf7d', normal: '#e8a13a', 'go-easy': '#e25d7a' };
const R = 34;
const CIRC = 2 * Math.PI * R;


function NeedStepper({ need }) {
  const set = (v) => updateSettings({ sleepNeedHours: Math.max(5, Math.min(11, +(v).toFixed(1))) });
  const btn = { width: 44, height: 44, borderRadius: 12, cursor: 'pointer', fontSize: 18, background: 'transparent', border: '0.5px solid var(--card-border)', color: 'var(--text-primary)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={label}>Sleep need</span>
      <button type="button" aria-label="Sleep need 30 minutes less" onClick={() => set(need - 0.5)} style={btn}>−</button>
      <span className="val-num" style={{ minWidth: 44, textAlign: 'center', fontSize: 15, color: 'var(--text-primary)' }}>{need} h</span>
      <button type="button" aria-label="Sleep need 30 minutes more" onClick={() => set(need + 0.5)} style={btn}>+</button>
    </div>
  );
}

export default function ReadinessCard({ compact = false }) {
  const r = useRecovery();
  const card = { padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 };

  if (r.status === 'no-data') {
    return (
      <section aria-label="Readiness" style={card}>
        <div style={label}>Readiness</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Log last night’s sleep (and 4+ nights for sleep debt) and Arete will score how ready you are to train.
        </div>
        <NeedStepper need={r.need} />
      </section>
    );
  }

  const colour = BAND_COLOUR[r.band];
  const debt = r.debt;
  return (
    <section aria-label="Readiness" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r={R} fill="none" stroke="var(--card-border)" strokeWidth="6" />
            <circle cx="40" cy="40" r={R} fill="none" stroke={colour} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - r.score / 100)} transform="rotate(-90 40 40)" />
          </svg>
          <span className="val-num" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 500, color: 'var(--text-primary)' }}>{r.score}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Readiness</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: colour }}>{r.label}</div>
          <div role="status" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)', marginTop: 2 }}>{r.advice}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {r.factors.map(f => (
          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: r.drag === f.key ? colour : 'var(--text-primary)' }}>{f.label}</span>
              <span className="val-num" style={{ color: 'var(--text-secondary)' }}>{f.pct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--hover-bg)', overflow: 'hidden' }}>
              <div style={{ width: `${f.pct}%`, height: '100%', background: r.drag === f.key ? colour : 'var(--tab-accent)' }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{f.note}</div>
          </div>
        ))}
      </div>

      {debt.status !== 'insufficient' && debt.debtHours >= 1 && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Sleep debt is <strong className="val-num" style={{ color: 'var(--text-primary)' }}>{debt.debtHours} h</strong>. {debt.debtHours > 10 ? 'A debt this size takes a couple of weeks of an extra hour a night to clear.' : `About an hour extra for ${Math.ceil(debt.debtHours)} night${Math.ceil(debt.debtHours) === 1 ? '' : 's'} clears it.`}
        </div>
      )}
      {r.night == null && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last night isn’t logged, so this leans on your recent nights.</div>}
      {r.load == null && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Training load joins the score once you have a few weeks of logged sessions.</div>}
      <NeedStepper need={r.need} />
    </section>
  );
}
