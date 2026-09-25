//  Tasks Tab 
// Split view: list left · detail/add panel right
// Firebase synced · localStorage fallback · voice commands

import { useState, useCallback, useMemo } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';

//  Helpers 
const PRIORITY = {
  high: { label: 'High', color: 'var(--priority-high)' },
  med:  { label: 'Med',  color: 'var(--priority-med)'  },
  low:  { label: 'Low',  color: 'var(--priority-low)'  },
};
const FILTERS = ['all', 'today', 'upcoming', 'completed'];

const REPEATS = {
  none:    { label: 'None'    },
  daily:   { label: 'Daily'   },
  weekly:  { label: 'Weekly'  },
  monthly: { label: 'Monthly' },
};

function todayStr() {
  return toLocalDateKey(new Date());
}

// Advance a YYYY-MM-DD date by a repeat cycle using UTC math (no timezone drift).
function advanceByRepeat(iso, repeat) {
  const base = iso || todayStr();
  const [y, m, d] = base.split('-').map(Number);
  if (!y || !m || !d) return base;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (repeat === 'daily')        dt.setUTCDate(dt.getUTCDate() + 1);
  else if (repeat === 'weekly')  dt.setUTCDate(dt.getUTCDate() + 7);
  else if (repeat === 'monthly') dt.setUTCMonth(dt.getUTCMonth() + 1);
  else return base;
  return dt.toISOString().split('T')[0];
}

function applyFilter(tasks, filter) {
  const today = todayStr();
  switch (filter) {
    case 'today':     return tasks.filter(t => !t.done && (!t.dueDate || t.dueDate === today));
    case 'upcoming':  return tasks.filter(t => !t.done && t.dueDate && t.dueDate > today);
    case 'completed': return tasks.filter(t => t.done);
    default:          return tasks.filter(t => !t.done);
  }
}

//  Icons 
const Icon = ({ d, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const CheckIcon  = () => <Icon d="M20 6L9 17l-5-5" />;
const TrashIcon  = () => <Icon d="M3 6h18 M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M10 11v6 M14 11v6" />;
const MicIcon    = () => <Icon d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />;
const EditIcon   = () => <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" />;

//  Pill badge 
function PriorityPill({ priority }) {
  const p = PRIORITY[priority] ?? PRIORITY.low;
  return (
    <span style={{
      fontSize: 9.5, padding: '2px 7px', borderRadius: 20, fontWeight: 500,
      letterSpacing: '0.04em',
      background: p.color + '1a',
      color: p.color,
      border: `0.5px solid ${p.color}55`,
    }}>
      {p.label}
    </span>
  );
}

//  Empty state 
function EmptyState({ filter, onAdd }) {
  const messages = {
    all:       { icon: "✅", text: "No pending tasks.", sub: "You're clear." },
    today:     { icon: '☀️', text: 'Nothing due today.', sub: 'Enjoy the day.' },
    upcoming:  { icon: '📅', text: 'No upcoming tasks.', sub: 'Schedule something.' },
    completed: { icon: '🏆', text: 'Nothing completed yet.', sub: 'Start ticking things off.' },
  };
  const m = messages[filter];
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.45,
    }}>
      <span style={{ fontSize: 28 }}>{m.icon}</span>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.text}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{m.sub}</div>
      </div>
    </div>
  );
}

//  Task row 
function TaskRow({ task, selected, onSelect, onToggle }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(task)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', cursor: 'pointer',
        background: selected ? 'var(--active-bg)' : hovered ? 'var(--hover-bg)' : 'transparent',
        borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        transition: 'all 0.15s ease',
        borderRadius: '0 8px 8px 0',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(task); }}
        style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          border: `1.5px solid ${task.done ? 'var(--accent)' : 'var(--card-border)'}`,
          background: task.done ? 'var(--active-bg)' : 'transparent',
          cursor: 'pointer', marginTop: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)',
          transition: 'all 0.15s ease',
        }}
      >
        {task.done && <CheckIcon />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: task.done ? 'var(--text-muted)' : 'var(--text-primary)',
          textDecoration: task.done ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: task.description ? 2 : 0,
        }}>
          {task.text}
        </div>
        {task.description && (
          <div style={{
            fontSize: 11.5, color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {task.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {task.priority && <PriorityPill priority={task.priority} />}
          {task.repeat && task.repeat !== 'none' && (
            <span style={{ fontSize: 10, color: 'var(--accent)' }} title={`Repeats ${REPEATS[task.repeat]?.label?.toLowerCase() ?? task.repeat}`}>🔁</span>
          )}
          {task.dueDate && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {task.category && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>
              {task.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

//  Detail / Add panel 
function TaskPanel({ mode, task, onSave, onDelete, onClose, onToggle }) {
  const isAdd  = mode === 'add';
  const isView = mode === 'view';
  const isEdit = mode === 'edit';

  const [form, setForm] = useState(
    isAdd ? { text: '', description: '', priority: 'med', dueDate: '', category: '', repeat: 'none' } :
    { text: task?.text ?? '', description: task?.description ?? '',
      priority: task?.priority ?? 'med', dueDate: task?.dueDate ?? '', category: task?.category ?? '',
      repeat: task?.repeat ?? 'none' }
  );
  const [editing, setEditing] = useState(isAdd);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (!mode) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, height: '100%',
        padding: '24px 16px', opacity: 0.4,
      }}>
        <span style={{ fontSize: 24 }}></span>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          Select a task to view details
        </p>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)',
    borderRadius: 7, padding: '7px 10px', fontSize: 12.5, color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 14px', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>
          {isAdd ? 'NEW TASK' : 'TASK DETAIL'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {isView && task && (
            <button onClick={() => setEditing(true)} style={iconBtnStyle} title="Edit">
              <EditIcon />
            </button>
          )}
          {isView && task && (
            <button onClick={() => onDelete(task.id)} style={iconBtnStyle} title="Delete">
              <TrashIcon />
            </button>
          )}
          <button onClick={onClose} style={{ ...iconBtnStyle, fontSize: 16, lineHeight: 1 }} title="Close"></button>
        </div>
      </div>

      {/* Form / View */}
      {(isAdd || editing) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <div>
            <label style={labelStyle}>Task *</label>
            <input
              autoFocus
              value={form.text}
              onChange={e => set('text', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSave(form); }}
              placeholder="What needs doing?"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: 'flex', gap: 5 }}>
              {Object.entries(PRIORITY).map(([k, p]) => (
                <button key={k} onClick={() => set('priority', k)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  border: `0.5px solid ${form.priority === k ? p.color : 'var(--card-border)'}`,
                  background: form.priority === k ? p.color + '22' : 'transparent',
                  color: form.priority === k ? p.color : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Due date</label>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <input value={form.category} onChange={e => set('category', e.target.value)}
              placeholder="e.g. Work, Personal…"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
            />
          </div>
          <div>
            <label style={labelStyle}>Repeat</label>
            <div style={{ display: 'flex', gap: 5 }}>
              {Object.entries(REPEATS).map(([k, r]) => (
                <button key={k} onClick={() => set('repeat', k)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10.5, fontWeight: 500,
                  border: `0.5px solid ${form.repeat === k ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: form.repeat === k ? 'var(--active-bg)' : 'transparent',
                  color: form.repeat === k ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
            <button onClick={() => { setEditing(false); if (isAdd) onClose(); }}
              style={{ flex: 1, ...ghostBtnStyle }}>Cancel</button>
            <button onClick={() => onSave({ ...form, id: task?.id })}
              disabled={!form.text.trim()}
              style={{ flex: 1, ...primaryBtnStyle, opacity: form.text.trim() ? 1 : 0.4 }}>
              {isAdd ? 'Add task' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0, fontWeight: 400 }}>
            {task.text}
          </p>
          {task.description && (
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {task.description}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {task.priority && (
              <Row label="Priority"><PriorityPill priority={task.priority} /></Row>
            )}
            {task.dueDate && (
              <Row label="Due">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </Row>
            )}
            {task.category && (
              <Row label="Category">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.category}</span>
              </Row>
            )}
            {task.repeat && task.repeat !== 'none' && (
              <Row label="Repeat">
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>🔁 {REPEATS[task.repeat]?.label ?? task.repeat}</span>
              </Row>
            )}
          </div>
          {/* Complete / Reopen */}
          <button
            onClick={() => onToggle(task)}
            style={{
              marginTop: 'auto', width: '100%', padding: '8px 0',
              borderRadius: 8, border: `0.5px solid ${task.done ? 'var(--card-border)' : 'var(--accent)'}`,
              background: task.done ? 'transparent' : 'var(--active-bg)',
              color: task.done ? 'var(--text-muted)' : 'var(--accent)',
              cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            {task.done ? '↩ Reopen' : '✓ Mark complete'}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', minWidth: 56 }}>{label}</span>
      {children}
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: 10, color: 'var(--text-muted)',
  letterSpacing: '0.06em', marginBottom: 4,
};
const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 4, borderRadius: 5,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'color 0.15s ease',
};
const ghostBtnStyle = {
  padding: '7px 0', borderRadius: 7, border: '0.5px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
  fontSize: 12, transition: 'all 0.15s ease',
};
const primaryBtnStyle = {
  padding: '7px 0', borderRadius: 7, border: '0.5px solid var(--card-border)',
  background: 'var(--active-bg)', color: 'var(--accent)', cursor: 'pointer',
  fontSize: 12, fontWeight: 500, transition: 'all 0.15s ease',
};

//  Main Tasks component 
export default function Tasks({ ai }) {
  const { items: tasks, add, update, remove, synced } = useCollection('tasks', STORAGE_KEYS.TASKS);
  const [filter, setFilter]     = useState('all');
  const [panel, setPanel]       = useState(null); // null | { mode:'add' } | { mode:'view'|'edit', task }
  const [voiceActive, setVoice] = useState(false);

  const filtered = useMemo(() => applyFilter(tasks, filter), [tasks, filter]);

  //  Toggle done
  const handleToggle = useCallback(async (task) => {
    const becomingDone = !task.done;
    await update(task.id, { done: becomingDone, completedAt: becomingDone ? new Date().toISOString() : null });
    // Recurring: when completed, spawn the next occurrence with an advanced due date
    if (becomingDone && task.repeat && task.repeat !== 'none') {
      await add({
        text: task.text, description: task.description || '',
        priority: task.priority || 'med',
        dueDate: advanceByRepeat(task.dueDate, task.repeat),
        category: task.category || '', repeat: task.repeat, done: false,
      });
    }
    // If marking done, close panel if it was showing this task
    if (becomingDone && panel?.task?.id === task.id) setPanel(null);
  }, [update, add, panel]);

  //  Save (add or edit) 
  const handleSave = useCallback(async (form) => {
    if (!form.text?.trim()) return;
    if (form.id) {
      await update(form.id, {
        text: form.text.trim(), description: form.description,
        priority: form.priority, dueDate: form.dueDate, category: form.category,
        repeat: form.repeat || 'none',
      });
      setPanel({ mode: 'view', task: { ...panel?.task, ...form } });
    } else {
      await add({
        text: form.text.trim(), description: form.description || '',
        priority: form.priority || 'med', dueDate: form.dueDate || '',
        category: form.category || '', repeat: form.repeat || 'none', done: false,
      });
      setPanel(null);
    }
  }, [add, update, panel]);

  //  Delete 
  const handleDelete = useCallback(async (id) => {
    await remove(id);
    setPanel(null);
  }, [remove]);

  //  Voice command 
  const handleVoice = useCallback(() => {
    if (!ai?.startListening) return;
    setVoice(true);
    ai.startListening((transcript) => {
      setVoice(false);
      const lower = transcript.toLowerCase();
      if (lower.startsWith('add task') || lower.startsWith('create task') || lower.startsWith('new task')) {
        const name = transcript.replace(/^(add|create|new)\s+task\s*/i, '').trim();
        if (name) {
          add({ text: name, description: '', priority: 'med', dueDate: '', category: '', done: false });
        } else {
          setPanel({ mode: 'add' });
        }
      } else if (lower.includes('complete') || lower.includes('done') || lower.includes('finish')) {
        const name = transcript.replace(/^(complete|mark|finish)\s*(task)?\s*/i, '').replace(/\s*(as done|as complete|complete)$/i, '').trim();
        const match = tasks.find(t => !t.done && t.text.toLowerCase().includes(name.toLowerCase()));
        if (match) update(match.id, { done: true });
      } else {
        // Fallback: treat as new task
        add({ text: transcript.trim(), description: '', priority: 'med', dueDate: '', category: '', done: false });
      }
    });
  }, [ai, add, update, tasks]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/*  Left: task list  */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        borderRight: '0.5px solid var(--sidebar-divider)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 12px',
          borderBottom: '0.5px solid var(--sidebar-divider)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
            Tasks
            {synced && (
              <span style={{ fontSize: 9.5, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
                 synced
              </span>
            )}
          </h2>
          {/* Voice */}
          <button onClick={handleVoice} disabled={!ai || voiceActive} title="Voice command"
            style={{
              ...iconBtnStyle,
              background: voiceActive ? 'var(--active-bg)' : 'transparent',
              color: voiceActive ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            <MicIcon />
          </button>
          {/* Add */}
          <button onClick={() => setPanel({ mode: 'add' })}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              background: 'var(--active-bg)', border: '0.5px solid var(--card-border)',
              color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.15s ease',
            }}>
            + New
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: 0, padding: '0 12px',
          borderBottom: '0.5px solid var(--sidebar-divider)', flexShrink: 0,
        }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 12px', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: `2px solid ${filter === f ? 'var(--accent)' : 'transparent'}`,
              color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
              letterSpacing: '0.03em',
              transition: 'all 0.15s ease',
              textTransform: 'capitalize',
            }}>
              {f}
              {f !== 'completed' && tasks.filter(t => !t.done).length > 0 && f === 'all' && (
                <span style={{
                  marginLeft: 5, fontSize: 9.5, padding: '1px 5px', borderRadius: 10,
                  background: 'var(--active-bg)', color: 'var(--accent)',
                }}>
                  {tasks.filter(t => !t.done).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {filtered.length === 0
            ? <EmptyState filter={filter} onAdd={() => setPanel({ mode: 'add' })} />
            : filtered.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                selected={panel?.task?.id === task.id}
                onSelect={t => setPanel({ mode: 'view', task: t })}
                onToggle={handleToggle}
              />
            ))
          }
        </div>
      </div>

      {/*  Right: detail / add panel  */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'var(--bg-panel)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
      }}>
        <TaskPanel
          mode={panel?.mode ?? null}
          task={panel?.task}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setPanel(null)}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
}

