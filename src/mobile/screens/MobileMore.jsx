//  MobileMore.jsx  Phone Tasks list and the placeholder sub-screen (the old More grid was removed) 
import { useState, useMemo, useRef } from 'react';
import { STORAGE_KEYS } from '../../utils/storage.js';
import { useCollection } from '../../supabase/useCollection.js';
import { haptics }       from '../utils/haptics.js';
import SwipeRow from '../SwipeRow.jsx';
import { normalizeTasks } from '../../domain/tasks.js';

// ── Shared card ────────────────────────────────────────────────────────────────
function MCard({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  );
}

// ── Back header with swipe-back support ────────────────────────────────────────
function SubHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10,
      paddingTop: 4, marginBottom: 20 }}>
      <button onClick={() => { haptics.tap(); onBack(); }} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
        color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
        WebkitTapHighlightColor: 'transparent', fontSize: 15,
      }}>
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
          <path d="M8 1L2 7.5 8 14" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        More
      </button>
      <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-primary)',
        borderLeft: '0.5px solid var(--card-border)', paddingLeft: 10 }}>
        {title}
      </div>
    </div>
  );
}

// ── Sub-screen wrapper with swipe-back ─────────────────────────────────────────
function SubScreen({ title, onBack, children }) {
  const ref      = useRef(null);
  const startX   = useRef(null);
  const startY   = useRef(null);
  const swiping  = useRef(false);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
  }
  function onTouchMove(e) {
    if (!startX.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (!swiping.current && dx > 12 && dy < 40 && startX.current < 40) {
      swiping.current = true;
    }
    if (swiping.current && ref.current) {
      ref.current.style.transform = `translateX(${Math.max(0, dx)}px)`;
      ref.current.style.opacity   = `${Math.max(0.5, 1 - dx / 300)}`;
    }
  }
  function onTouchEnd(e) {
    if (!ref.current) return;
    const dx = e.changedTouches[0].clientX - (startX.current || 0);
    ref.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
    if (swiping.current && dx > 100) {
      ref.current.style.transform = 'translateX(100%)';
      ref.current.style.opacity   = '0';
      setTimeout(() => { haptics.tap(); onBack(); }, 220);
    } else {
      ref.current.style.transform = 'translateX(0)';
      ref.current.style.opacity   = '1';
    }
    setTimeout(() => { if (ref.current) ref.current.style.transition = ''; }, 300);
    startX.current = null; swiping.current = false;
  }

  // Rendered as a group section (MobileShell) rather than a pushed sub-screen:
  // no back header, no swipe-back.
  // The screen padding used to come from the More grid, which is gone.
  if (!onBack) return <div style={{ padding: 16 }}>{children}</div>;

  return (
    <div ref={ref} style={{ willChange: 'transform, opacity' }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <SubHeader title={title} onBack={onBack} />
      {children}
    </div>
  );
}

// ── Tasks sub-screen ───────────────────────────────────────────────────────────
export function TasksScreen({ onBack }) {
  // Was raw localStorage (storage.get/set) — tasks added on the phone never
  // reached Supabase, so they never appeared on desktop. Same table/schema as
  // the desktop Tasks tab now.
  const { items: rawTasks = [], add, update, remove: removeTask } = useCollection('tasks', STORAGE_KEYS.TASKS);
  const tasks = useMemo(() => normalizeTasks(rawTasks), [rawTasks]);
  const [input,  setInput]  = useState('');
  const [filter, setFilter] = useState('pending');

  function addTask() {
    if (!input.trim()) return;
    haptics.success();
    add({ text: input.trim(), description: '', priority: 'med', dueDate: '', category: '', repeat: 'none', done: false });
    setInput('');
  }
  function toggle(t) {
    haptics.light();
    update(t.id, { done: !t.done, completedAt: !t.done ? new Date().toISOString() : null });
  }
  // Delete with an Undo that puts the same task back (done state and notes included).
  async function remove(task) {
    haptics.tap();
    await removeTask(task.id);
    const { id: _gone, ...rest } = task;
    window.dispatchEvent(new CustomEvent('valerie:toast', { detail: {
      message: 'Deleted ' + (task.text || 'task'), type: 'success',
      undo: () => add(rest),
    } }));
  }

  const filtered = useMemo(() => {
    if (filter === 'pending') return tasks.filter(t => !t.done);
    if (filter === 'done')    return tasks.filter(t =>  t.done);
    return tasks;
  }, [tasks, filter]);

  const doneCount    = tasks.filter(t =>  t.done).length;
  const pendingCount = tasks.filter(t => !t.done).length;

  return (
    <SubScreen title="Tasks" onBack={onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doneCount}/{tasks.length} done</span>
        </div>

        <MCard style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Add a task…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 14, color: 'var(--text-primary)', caretColor: 'var(--accent)' }} />
            <button onClick={addTask} style={{
              background: 'var(--accent)', color: 'var(--bg-base)', border: 'none',
              borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              opacity: input.trim() ? 1 : 0.4,
            }}>Add</button>
          </div>
        </MCard>

        <div style={{ display: 'flex', gap: 8 }}>
          {[['pending', `Pending (${pendingCount})`], ['done', `Done (${doneCount})`], ['all', 'All']].map(([v, label]) => (
            <button key={v} onClick={() => { haptics.tap(); setFilter(v); }} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12,
              fontWeight: filter === v ? 600 : 400, cursor: 'pointer',
              border: filter === v ? '1px solid var(--accent)' : '0.5px solid var(--card-border)',
              background: filter === v ? 'var(--active-bg)' : 'none',
              color: filter === v ? 'var(--accent)' : 'var(--text-secondary)',
              WebkitTapHighlightColor: 'transparent',
            }}>{label}</button>
          ))}
        </div>

        <MCard style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)' }}>
              {filter === 'pending' ? 'All clear — you\'re on top of everything.' : 'No tasks here.'}
            </div>
          ) : (
            filtered.map((t, i) => (
              <SwipeRow key={t.id} onDelete={() => remove(t)} style={{ borderBottom: i < filtered.length - 1 ? '0.5px solid var(--card-border)' : 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
              }}>
                <button onClick={() => toggle(t)} style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: t.done ? 'none' : '1.5px solid var(--card-border)',
                  background: t.done ? 'var(--accent)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                }}>
                  {t.done && <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4l3 3 6-6" stroke="var(--bg-base)" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </button>
                <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4,
                  color: t.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                <button onClick={() => remove(t)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '4px', fontSize: 16,
                  WebkitTapHighlightColor: 'transparent', lineHeight: 1,
                }}>×</button>
              </div>
              </SwipeRow>
            ))
          )}
        </MCard>
      </div>
    </SubScreen>
  );
}

// ── Placeholder sub-screen ─────────────────────────────────────────────────────
export function PlaceholderScreen({ title, onBack }) {
  return (
    <SubScreen title={title} onBack={onBack}>
      <MCard style={{ padding: '24px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {title} is on the desktop app for now. Anything you add there shows up here.
        </div>
      </MCard>
    </SubScreen>
  );
}
