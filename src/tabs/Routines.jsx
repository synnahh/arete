// ─── Routines Tab ─────────────────────────────────────────────────────────────
// Build named routines (Morning, Evening, Pre-workout, etc.) with ordered steps.
// Each step has a time, label, and optional duration/notes.
// Reminders can be set per-routine with day selection.

import { Icon as LineIcon } from '../components/icons.jsx';
import { useState, useEffect } from 'react';
import { useCollection }       from '../supabase/useCollection.js';
import { getUserIdSync }        from '../supabase/supabase.js';
import { STORAGE_KEYS, storage } from '../utils/storage.js';
import { sanitizePayload }     from '../utils/sanitize.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const INPUT = {
  padding: '8px 12px', borderRadius: 8, border: '0.5px solid var(--card-border)',
  background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};
const BTN_ACCENT = {
  padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500,
};
const BTN_GHOST = {
  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: 13,
};

// ─── Step editor ──────────────────────────────────────────────────────────────
function StepRow({ step, index, onChange, onRemove, onMove, total }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: '0.5px solid var(--card-border)', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button disabled={index === 0} onClick={() => onMove(index, -1)}
          style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: 11, opacity: index === 0 ? 0.3 : 0.7, lineHeight: 1 }}></button>
        <button disabled={index === total - 1} onClick={() => onMove(index, 1)}
          style={{ background: 'none', border: 'none', cursor: index === total - 1 ? 'default' : 'pointer', color: 'var(--text-muted)', fontSize: 11, opacity: index === total - 1 ? 0.3 : 0.7, lineHeight: 1 }}></button>
      </div>
      <input type="time" value={step.time || ''} onChange={e => onChange(index, 'time', e.target.value)}
        style={{ ...INPUT, width: 90, flexShrink: 0 }} />
      <input placeholder="Step name…" value={step.label || ''} onChange={e => onChange(index, 'label', e.target.value)}
        style={{ ...INPUT, flex: 1 }} />
      <input placeholder="Notes" value={step.notes || ''} onChange={e => onChange(index, 'notes', e.target.value)}
        style={{ ...INPUT, flex: 1, fontSize: 12, color: 'var(--text-muted)' }} />
      <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e55a5a', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
    </div>
  );
}

// ─── Routine card ─────────────────────────────────────────────────────────────
function RoutineCard({ routine, onEdit, onDelete }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const isActiveToday = routine.reminder?.days?.includes(today);

  return (
    <div style={{
      border: '0.5px solid var(--card-border)', borderRadius: 14,
      background: 'var(--bg-panel)', overflow: 'hidden', marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-primary)' }}>{routine.name}</span>
            {isActiveToday && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)', letterSpacing: '0.05em' }}>TODAY</span>
            )}
          </div>
          {routine.reminder?.enabled && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {routine.reminder.time} · {routine.reminder.days?.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(routine)} style={BTN_GHOST}>Edit</button>
          <button onClick={() => onDelete(routine.id)} style={{ ...BTN_GHOST, color: '#e55a5a' }}>Delete</button>
        </div>
      </div>

      {/* Steps */}
      {routine.steps?.length > 0 && (
        <div style={{ borderTop: '0.5px solid var(--card-border)' }}>
          {routine.steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 20px',
              borderBottom: i < routine.steps.length - 1 ? '0.5px solid var(--card-border)' : 'none',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, opacity: 0.6 }} />
              {step.time && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 42 }}>{step.time}</span>
              )}
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{step.label}</span>
              {step.notes && <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Routine form ─────────────────────────────────────────────────────────────
function RoutineForm({ initial, onSave, onCancel }) {
  const [name,    setName]    = useState(initial?.name    || '');
  const [steps,   setSteps]   = useState(initial?.steps   || [{ time: '', label: '', notes: '' }]);
  const [remEn,   setRemEn]   = useState(initial?.reminder?.enabled || false);
  const [remTime, setRemTime] = useState(initial?.reminder?.time    || '07:00');
  const [remDays, setRemDays] = useState(initial?.reminder?.days    || ['mon','tue','wed','thu','fri']);

  function addStep() { setSteps(s => [...s, { time: '', label: '', notes: '' }]); }
  function changeStep(i, key, val) { setSteps(s => s.map((step, idx) => idx === i ? { ...step, [key]: val } : step)); }
  function removeStep(i) { setSteps(s => s.filter((_, idx) => idx !== i)); }
  function moveStep(i, dir) {
    setSteps(s => {
      const a = [...s]; const b = a[i + dir]; a[i + dir] = a[i]; a[i] = b; return a;
    });
  }
  function toggleDay(d) {
    setRemDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]);
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      steps: steps.filter(s => s.label.trim()),
      reminder: { enabled: remEn, time: remTime, days: remDays },
    });
  }

  return (
    <div style={{ border: '0.5px solid var(--card-border)', borderRadius: 14, background: 'var(--bg-panel)', padding: '22px 24px', marginBottom: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <input placeholder="Routine name (e.g. Morning)" value={name} onChange={e => setName(e.target.value)}
          style={{ ...INPUT, width: '100%', fontSize: 16, fontWeight: 300, boxSizing: 'border-box' }} autoFocus />
      </div>

      {/* Steps */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>STEPS</div>
      {steps.map((step, i) => (
        <StepRow key={i} step={step} index={i} total={steps.length} onChange={changeStep} onRemove={removeStep} onMove={moveStep} />
      ))}
      <button onClick={addStep} style={{ ...BTN_GHOST, fontSize: 12, marginBottom: 20 }}>+ Add step</button>

      {/* Reminders */}
      <div style={{ borderTop: '0.5px solid var(--card-border)', paddingTop: 18, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: remEn ? 14 : 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Reminder</div>
          <div onClick={() => setRemEn(v => !v)} style={{
            width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer',
            background: remEn ? 'var(--accent)' : 'var(--hover-bg)', border: '0.5px solid var(--card-border)', transition: 'background 0.2s',
          }}>
            <div style={{ position: 'absolute', top: 2, left: remEn ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
        </div>
        {remEn && (
          <>
            <input type="time" value={remTime} onChange={e => setRemTime(e.target.value)} style={{ ...INPUT, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAY_KEYS.map((d, i) => (
                <button key={d} onClick={() => toggleDay(d)} style={{
                  width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: remDays.includes(d) ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  color: remDays.includes(d) ? '#fff' : 'var(--text-secondary)',
                }}>
                  {DAYS[i]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Push/SMS notifications  configure in Settings   Notifications
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={handleSave} style={BTN_ACCENT}>Save</button>
        <button onClick={onCancel} style={BTN_GHOST}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Routines Tab ────────────────────────────────────────────────────────
export default function Routines({ settings }) {
  const routines = useCollection('routines', STORAGE_KEYS.ROUTINES);
  const [editing, setEditing] = useState(null); // null | 'new' | routine object
  const userId = getUserIdSync();

  async function handleSave(data) {
    const payload = sanitizePayload({ ...data, updatedAt: Date.now() });
    if (editing === 'new') {
      await routines.add({ ...payload, createdAt: Date.now() });
    } else {
      await routines.update(editing.id, payload);
    }
    setEditing(null);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this routine?')) return;
    await routines.remove(id);
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Routines</div>
          <button onClick={() => setEditing('new')} style={BTN_ACCENT} disabled={editing !== null}>
            + New Routine
          </button>
        </div>
        <div style={{ height: '0.5px', background: 'var(--card-border)' }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
        {editing && (
          <RoutineForm
            initial={editing === 'new' ? null : editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}

        {routines.items.length === 0 && !editing && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><LineIcon name="routines" size={30} strokeWidth={1.5} /></div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>No routines yet</div>
            <div style={{ fontSize: 12 }}>Build your first routine and it appears in your Next moves and daily plan.</div>
          </div>
        )}

        {routines.items
          .filter(r => r.id !== editing?.id)
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
          .map(r => (
            <RoutineCard key={r.id} routine={r} onEdit={r => setEditing(r)} onDelete={handleDelete} />
          ))}
      </div>
    </div>
  );
}


