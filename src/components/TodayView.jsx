// TodayView.jsx — unified "Today" command center across every tab.
// Opened via the `valerie:today` event (Ctrl+K → "Today"). Read-only summary of
// everything that matters today, with one-tap jump to the relevant tab.

import { useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey, isOnLocalDay } from '../utils/localDate.js';
import { dueItems } from '../domain/ahead.js';
import { suppliesWithUsage } from '../utils/supplies.js';

const arr = (k) => { const v = storage.get(k, []); return Array.isArray(v) ? v : (v?.daily || []); };
const todayStr = () => toLocalDateKey(new Date());

function gather() {
  const t = todayStr();

  const events = arr(STORAGE_KEYS.EVENTS)
    .filter(e => e.date === t)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const tasksAll = arr(STORAGE_KEYS.TASKS).filter(x => !x.done && !x.completed);
  const overdue = tasksAll.filter(x => x.dueDate && x.dueDate < t);
  const dueToday = tasksAll.filter(x => x.dueDate === t);

  // Supplies to reorder within a week (Ahead engine forecast)
  const restock = dueItems(suppliesWithUsage(arr(STORAGE_KEYS.ESSENTIALS), t), t).map(({ item, f }) => ({ name: item.name, days: f.daysToReorder }));

  // Momentum
  const streaks = arr(STORAGE_KEYS.HABITS).filter(h => (h.streak || 0) > 0)
    .sort((a, b) => (b.streak || 0) - (a.streak || 0)).slice(0, 3);
  const focusToday = arr(STORAGE_KEYS.FOCUS_SESSIONS).filter(s => isOnLocalDay(s.date || s.completedAt, t)).length;
  const lmToday = arr('valerie_lm_daily').find(d => d.date === t);

  return { events, overdue, dueToday, restock, streaks, focusToday, lmPct: lmToday?.pct ?? null };
}

function Section({ title, accent, count, tab, onGo, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'ui-monospace,monospace' }}>{title}</span>
        {count != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count}</span>}
        <div style={{ flex: 1 }} />
        {tab && <button onClick={() => onGo(tab)} style={{ background: 'none', border: 'none', color: accent, fontSize: 11, cursor: 'pointer' }}>open →</button>}
      </div>
      {children}
    </div>
  );
}

const itemRow = { padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', gap: 10 };

export default function TodayView({ onTabChange }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    const handler = () => { setData(gather()); setOpen(true); };
    window.addEventListener('valerie:today', handler);
    return () => window.removeEventListener('valerie:today', handler);
  }, []);

  if (!open || !data) return null;
  const go = (tab) => { onTabChange?.(tab); setOpen(false); };
  const empty = !data.events.length && !data.overdue.length && !data.dueToday.length && !data.restock.length;
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div onClick={() => setOpen(false)} style={{
      position: 'fixed', inset: 0, zIndex: 920, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 540, maxWidth: '100%', maxHeight: '84vh', background: 'var(--bg-panel)',
        border: '0.5px solid var(--card-border)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'valFadeUp 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '0.5px solid var(--card-border)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-primary)' }}>Today</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateLabel}</div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ padding: '18px 24px 24px', overflowY: 'auto' }}>
          {empty && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Nothing scheduled or overdue today. Clear runway. 🚀
            </div>
          )}

          {data.events.length > 0 && (
            <Section title="Schedule" accent="#4a9eff" count={`${data.events.length}`} tab="calendar" onGo={go}>
              {data.events.map((e, i) => (
                <div key={i} style={itemRow}><span>{e.title}</span><span style={{ color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{e.time || 'all day'}</span></div>
              ))}
            </Section>
          )}

          {(data.overdue.length > 0 || data.dueToday.length > 0) && (
            <Section title="Tasks" accent={data.overdue.length ? '#e55a5a' : '#f4a642'} count={`${data.overdue.length + data.dueToday.length}`} tab="tasks" onGo={go}>
              {data.overdue.map((x, i) => (
                <div key={'o' + i} style={itemRow}><span>{x.text || x.title}</span><span style={{ color: '#e55a5a', fontSize: 11 }}>overdue</span></div>
              ))}
              {data.dueToday.map((x, i) => (
                <div key={'d' + i} style={itemRow}><span>{x.text || x.title}</span><span style={{ color: '#f4a642', fontSize: 11 }}>today</span></div>
              ))}
            </Section>
          )}

          {data.restock.length > 0 && (
            <Section title="Reorder soon" accent="#f4a642" count={`${data.restock.length}`} tab="essentials" onGo={go}>
              {data.restock.map((r, i) => (
                <div key={i} style={itemRow}><span>{r.name}</span><span style={{ color: r.days <= 0 ? '#e55a5a' : '#f4a642', fontSize: 11 }}>{r.days <= 0 ? 'order now' : `order in ${r.days}d`}</span></div>
              ))}
            </Section>
          )}

          <Section title="Momentum" accent="#6BE3A4" tab="progress" onGo={go}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.streaks.map((h, i) => (
                <span key={i} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 20, background: 'rgba(107,227,164,0.1)', color: '#6BE3A4' }}>🔥 {h.name} {h.streak}d</span>
              ))}
              {data.focusToday > 0 && <span style={{ fontSize: 12, padding: '5px 10px', borderRadius: 20, background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>⏱️ {data.focusToday} focus today</span>}
              {data.lmPct != null && <span style={{ fontSize: 12, padding: '5px 10px', borderRadius: 20, background: 'rgba(74,158,255,0.1)', color: '#4a9eff' }}>LM daily {data.lmPct}%</span>}
              {!data.streaks.length && data.focusToday === 0 && data.lmPct == null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No streaks yet — start one today.</span>}
            </div>
          </Section>
        </div>
        <style>{`@keyframes valFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>
    </div>
  );
}
