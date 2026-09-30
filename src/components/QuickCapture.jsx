// Quick add — a floating "add a task" box reachable from any screen.
// Ctrl+Space opens it, Enter saves the task, Esc closes. Tasks land in Plan > Tasks.
import { useState, useEffect, useRef } from 'react';
import { useTasks } from '../hooks/useTasks.js';
import { Icon } from './icons.jsx';

export default function QuickCapture() {
  const { addTask } = useTasks();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState(''); // '' | 'saving' | 'saved' | 'failed'
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); setOpen(prev => !prev); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    else { setText(''); setStatus(''); }
  }, [open]);

  async function save() {
    const t = text.trim();
    if (!t || status === 'saving') return;
    setStatus('saving');
    const id = await addTask(t, { priority: 'low' });
    if (!id) { setStatus('failed'); return; } // keep the text so nothing is lost
    setText(''); setStatus('saved');
    setTimeout(() => setOpen(false), 500);
  }

  if (!open) {
    return (
      <button type="button" title="Add a task (Ctrl+Space)" aria-label="Add a task" onClick={() => setOpen(true)}
        style={{
          position: 'absolute', bottom: 24, right: 24, zIndex: 100,
          width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--active-bg)', border: '0.5px solid var(--card-border)', color: 'var(--accent)',
          backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
        <Icon name="plus" size={20} />
      </button>
    );
  }

  return (
    <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 200 }}>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)', zIndex: -1 }} />
      <div role="dialog" aria-label="Add a task" style={{
        width: 360, padding: '12px 14px', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10,
        background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
        animation: 'slide-up 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          ADD A TASK
          <span style={{ marginLeft: 'auto', letterSpacing: 0 }}>Esc to close</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={inputRef} value={text} onChange={e => { setText(e.target.value); setStatus(''); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            placeholder="What needs doing?" aria-label="Task"
            style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 8, fontSize: 13.5, outline: 'none', background: 'var(--input-bg)', border: '0.5px solid var(--input-border)', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
          <button type="button" onClick={save} disabled={!text.trim() || status === 'saving'} aria-label="Save task"
            style={{ width: 36, height: 36, borderRadius: 8, border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', background: text.trim() ? 'var(--active-bg)' : 'var(--hover-bg)', color: text.trim() ? 'var(--accent)' : 'var(--text-muted)' }}>
            <Icon name="check" size={18} />
          </button>
        </div>
        {status === 'saved' && <div role="status" style={{ fontSize: 12, color: '#4caf7d' }}>Added to Tasks.</div>}
        {status === 'failed' && <div role="alert" style={{ fontSize: 12, color: '#e25d7a' }}>Couldn't save. Your text is still here; try again.</div>}
      </div>
    </div>
  );
}
