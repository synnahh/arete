// Insights — week / month / year views of the things you log, the weekly recap, the
// logging streak, and one honest correlation (rules: domain/insights.js, domain/recap.js).
import { useMemo, useState } from 'react';
import { useRecap } from '../hooks/useRecap.js';
import { insightSeries, sleepTrainingLink, RANGES } from '../domain/insights.js';
import TrendChart from '../components/TrendChart.jsx';
import RecapCard from '../components/RecapCard.jsx';
import StreakCard from '../components/StreakCard.jsx';
import LogCalendar from '../components/LogCalendar.jsx';
import { label } from '../components/ui.js';

const CARD = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 };
const RANGE_IDS = Object.keys(RANGES);

function ChartCard({ title, series, unit, digits = 1, kind = 'line', target = null, note, empty }) {
  const s = series?.summary;
  return (
    <section aria-label={title} style={CARD}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={label}>{title}</div>
        {s && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            avg {digits === 0 ? Math.round(s.avg).toLocaleString() : s.avg}{unit}{s.n > 1 && kind === 'line' ? ` · ${s.change > 0 ? '+' : ''}${s.change}${unit} over the range` : ''}
          </div>
        )}
      </div>
      {series ? <TrendChart points={series.points} unit={unit} digits={digits} kind={kind} target={target} /> : <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{empty}</div>}
      {note && series && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{note}</div>}
    </section>
  );
}

export default function Insights() {
  const { recap, streak, data } = useRecap();
  const [range, setRange] = useState('month');
  const view = useMemo(() => insightSeries(data, range, data.today), [data, range]);
  const link = useMemo(() => sleepTrainingLink(data, data.today), [data]);
  const year = range === 'year';

  return (
    <div style={{ padding: '20px clamp(14px, 3vw, 28px) 40px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1040, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>Insights</h1>
        <div role="tablist" aria-label="Range" style={{ display: 'inline-flex', padding: 3, borderRadius: 10, background: 'var(--hover-bg)', gap: 2 }}>
          {RANGE_IDS.map(id => (
            <button key={id} type="button" role="tab" aria-selected={range === id} onClick={() => setRange(id)}
              style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: range === id ? 'var(--tab-accent)' : 'transparent', color: range === id ? 'var(--on-tab-accent, #111)' : 'var(--text-secondary)' }}>
              {RANGES[id].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
        <RecapCard recap={recap} />
        <StreakCard streak={streak} />
      </div>

      <LogCalendar data={data} />

      {link && (
        <section aria-label="Pattern" style={CARD}>
          <div style={label}>A pattern in your logs</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)' }}>{link.text}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{link.caution}</div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16 }}>
        <ChartCard title="Weight" series={view?.weight} unit=" kg" empty="Weigh in a few times and the trend shows here." note={year ? 'Weekly averages.' : null} />
        <ChartCard title="Calories" series={view?.calories} unit="" digits={0} kind="bar" target={view?.targetKcal} empty="Log food and your daily calories show here." note={year ? 'Weekly average per logged day.' : 'Total per logged day.'} />
        <ChartCard title="Sleep" series={view?.sleep} unit=" h" empty="Log sleep on Recover and nights show here." note={year ? 'Weekly average.' : null} />
        <ChartCard title="Training volume" series={view?.volume} unit="" digits={0} kind="bar" empty="Log sets in Train and your volume shows here." note={year ? 'Total weight lifted per week (sets x reps x kg).' : 'Total weight lifted per training day (sets x reps x kg).'} />
      </div>
    </div>
  );
}
