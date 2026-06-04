// ─── MobileTasks.jsx — Tasks screen for VALERIE iOS PWA ─────────────────────
import { useState, useMemo } from 'react';
import { storage, STORAGE_KEYS } from '../../utils/storage.js';

function MCard({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, padding: '16px 18px', ...style }}>
      {children}
    </div>
  );
}

export default function MobileTasks() {
  const [tasks, setTasks]   = useState(() => storage.get(STORAGE_KEYS.TASKS, []));
  const [input, setInput]   = useState('');
  const [filter, setFilter] = useState('pending'); // pending | done | all

  function save(updated) {
    setTasks(updated);
    storage.set(STORAGE_KEYS.TASKS, updated);
  }

  function addTask() {
    if (!input.trim()) return;
    const t = { id: Date.now(), text: input.trim(), done: false, createdAt: new Date().toISOString() };
    save([t, ...tasks]);
    setInput('');
  }

  function toggle(id) {
    save(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function remove(id) {
    save(tasks.filter(t => t.id !== id));
  }

  const filtered = useMemo(() => {
    if (filter === 'pending') return tasks.filter(t => !t.done);
    if (filter === 'done')    return tasks.filter(t =>  t.done);
    return tasks;
  }, [tasks, filter]);

  const doneCount    = tasks.filter(t =>  t.done).length;
  const pendingCount = tasks.filter(t => !t.done).length;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        paddingTop: 4, marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)' }}>Tasks</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {doneCount}/{tasks.length} done
        </div>
      </div>

      {/* Add task */}
      <MCard style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Add a task…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 14, color: 'var(--text-primary)',
              caretColor: 'var(--accent)',
            }}
          />
          <button onClick={addTask} style={{
            background: 'var(--accent)', color: 'var(--bg-base)',
            border: 'none', borderRadius: 8, padding: '6px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            opacity: input.trim() ? 1 : 0.4,
          }}>Add</button>
        </div>
      </MCard>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['pending', `Pending (${pendingCount})`], ['done', `Done (${doneCount})`], ['all', 'All']].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12,
            fontWeight: filter === v ? 600 : 400, cursor: 'pointer',
            border: filter === v ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
            background: filter === v ? 'var(--active-bg)' : 'none',
            color: filter === v ? 'var(--accent)' : 'var(--text-secondary)',
            WebkitTapHighlightColor: 'transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* Task list */}
      <MCard style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)' }}>
            {filter === 'pending' ? 'All clear — you\'re on top of everything.' : 'No tasks here.'}
          </div>
        ) : (
          filtered.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px',
              borderBottom: i < filtered.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              {/* Checkbox */}
              <button onClick={() => toggle(t.id)} style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: t.done ? 'none' : '1.5px solid var(--card-border)',
                background: t.done ? 'var(--accent)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}>
                {t.done && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4l3 3 6-6" stroke="var(--bg-base)" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* Text */}
              <span style={{
                flex: 1, fontSize: 14, color: t.done ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: t.done ? 'line-through' : 'none', lineHeight: 1.4,
              }}>{t.text}</span>

              {/* Delete */}
              <button onClick={() => remove(t.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '4px', fontSize: 16,
                WebkitTapHighlightColor: 'transparent', lineHeight: 1,
              }}>×</button>
            </div>
          ))
        )}
      </MCard>
    </div>
  );
}
