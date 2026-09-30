// NudgeStack — ambient, dismissible "heads up" chips (proactive nudges).
// Mounted once at app level. Computes from local data on mount, shows the top few,
// remembers dismissals for the session. Click a nudge to jump to the relevant tab.

import { useState, useEffect } from 'react';
import { computeNudges } from '../hooks/useNudges.js';
import { requestHealthSection } from '../nav/healthSection.js';

const SEVERITY = {
  info:  { dot: '#4a9eff', border: 'rgba(74,158,255,0.35)' },
  warn:  { dot: '#f4a642', border: 'rgba(244,166,66,0.35)' },
  alert: { dot: '#e55a5a', border: 'rgba(229,90,90,0.4)' },
};

const dismissedKey = 'valerie_nudges_dismissed';
const getDismissed = () => { try { return JSON.parse(sessionStorage.getItem(dismissedKey) || '[]'); } catch { return []; } };

export default function NudgeStack({ onTabChange }) {
  const [nudges, setNudges] = useState([]);

  useEffect(() => {
    const refresh = () => {
      const dismissed = getDismissed();
      setNudges(computeNudges().filter(n => !dismissed.includes(n.id)));
    };
    // small delay so data hooks have hydrated from storage/Supabase
    const t = setTimeout(refresh, 3000);
    const id = setInterval(refresh, 5 * 60 * 1000); // re-evaluate every 5 min
    window.addEventListener('valerie:data-changed', refresh);
    return () => { clearTimeout(t); clearInterval(id); window.removeEventListener('valerie:data-changed', refresh); };
  }, []);

  function dismiss(id) {
    const next = [...getDismissed(), id];
    sessionStorage.setItem(dismissedKey, JSON.stringify(next));
    setNudges(prev => prev.filter(n => n.id !== id));
  }

  if (!nudges.length) return null;

  return (
    <div style={{
      // Bottom right, above the quick-capture button, so it never covers a screen's header or its buttons.
      position: 'fixed', bottom: 84, right: 24, zIndex: 850,
      display: 'flex', flexDirection: 'column-reverse', gap: 8, width: 300,
    }}>
      {nudges.map(n => {
        const s = SEVERITY[n.severity] || SEVERITY.info;
        return (
          <div key={n.id}
            onClick={() => { if (n.section) requestHealthSection(n.section); onTabChange?.(n.tab); dismiss(n.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
              background: 'var(--bg-panel)', border: `0.5px solid ${s.border}`,
              backdropFilter: 'blur(20px)', boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
              animation: 'nudgeIn 0.28s cubic-bezier(0.32,0.72,0,1)',
            }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>{n.text}</span>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, width: 28, height: 28, margin: '-6px -6px -6px 0', borderRadius: 8, flexShrink: 0 }}
              aria-label="Dismiss">&times;</button>
          </div>
        );
      })}
      <style>{`@keyframes nudgeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
