// RecapCard — the last 7 days against the 7 before (rules: src/domain/recap.js).
// On Home it appears Monday and Tuesday until dismissed; Insights always shows it.
import { label } from './ui.js';

const num = { fontFamily: 'var(--font-mono)' };

function Stat({ title, value, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...label, marginBottom: 4 }}>{title}</div>
      <div className="val-num" style={{ ...num, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const diff = (now, before, unit = '') => (before == null || now == null ? null : now === before ? 'same as the week before' : `${now > before ? '+' : ''}${Math.round((now - before) * 10) / 10}${unit} on the week before`);
const short = (k) => new Date(`${k}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function RecapCard({ recap, onDismiss, compact = false }) {
  if (!recap) {
    return (
      <section aria-label="Weekly recap" style={card(compact)}>
        <div style={label}>Weekly recap</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Log training, food, sleep or habits and your week gets summed up here.</div>
      </section>
    );
  }
  const { week: w, prev: p } = recap;
  const kcalSub = w.onTarget != null ? `${w.onTarget} of 7 days near target` : `${w.foodDays} of 7 days logged`;
  return (
    <section aria-label="Weekly recap" style={card(compact)}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={label}>Your week · {short(recap.from)} – {short(recap.to)}</div>
        {onDismiss && <button type="button" onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer', padding: 4 }}>Dismiss</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
        <Stat title="Training" value={`${w.sessions} day${w.sessions === 1 ? '' : 's'}`} sub={`${recap.planned} planned${diff(w.sessions, p.sessions) ? ` · ${diff(w.sessions, p.sessions)}` : ''}`} />
        {w.avgKcal != null && <Stat title="Calories" value={`${w.avgKcal.toLocaleString()}`} sub={kcalSub} />}
        {w.avgSleep != null && <Stat title="Sleep" value={`${w.avgSleep} h`} sub={`${w.nights} night${w.nights === 1 ? '' : 's'} logged`} />}
        {w.habitPct != null && <Stat title="Habits" value={`${w.habitPct}%`} sub={diff(w.habitPct, p.habitPct, '%')} />}
        {recap.weightChange != null && <Stat title="Weight" value={`${recap.weightChange > 0 ? '+' : ''}${recap.weightChange} kg`} sub="weekly average vs the week before" />}
      </div>
      {(recap.win || recap.fix) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, lineHeight: 1.45 }}>
          {recap.win && <div><span style={{ color: 'var(--tab-accent)', fontWeight: 600 }}>Win · </span><span style={{ color: 'var(--text-primary)' }}>{recap.win.text}</span></div>}
          {recap.fix && <div><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Next week · </span><span style={{ color: 'var(--text-primary)' }}>{recap.fix.text}</span></div>}
        </div>
      )}
    </section>
  );
}

const card = (compact) => ({ padding: compact ? 14 : 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 14 });
