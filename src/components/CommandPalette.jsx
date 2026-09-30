// ─── CommandPalette — Ctrl+K Spotlight-style overlay ──────────────────────────
// Searches commands + live app data (tasks, notes, events, essentials, lists).
// Keyboard navigation: ↑/↓ to move, Enter to execute, Escape to close.

import { Icon } from './icons.jsx';
import { useState, useEffect, useRef, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { applyTheme } from '../styles/themes.js';
import { exportBackup, importBackup } from '../utils/backup.js';
import { screenForHealthSection } from '../nav/healthSection.js';

const toast = (message, type = 'success') =>
  window.dispatchEvent(new CustomEvent('valerie:toast', { detail: { message, type } }));

// ─── Static command definitions ────────────────────────────────────────────────
function buildStaticCommands(onTabChange) {
  return [
    // Navigation
    { id: 'nav-dashboard',  label: 'Go to Dashboard',   category: 'Navigate', icon: 'home', action: () => onTabChange('dashboard')  },
    { id: 'nav-tasks',      label: 'Go to Tasks',       category: 'Navigate', icon: 'tasks',  action: () => onTabChange('tasks')      },
    { id: 'nav-calendar',   label: 'Go to Calendar',    category: 'Navigate', icon: 'calendar', action: () => onTabChange('calendar')   },
    { id: 'nav-notes',      label: 'Go to Notes',       category: 'Navigate', icon: 'notes', action: () => onTabChange('notes')      },
    { id: 'nav-health',     label: 'Go to Coach',       category: 'Navigate', icon: 'coach', action: () => onTabChange('coach')      },
    { id: 'nav-goal',       label: 'Go to Goal HQ',     category: 'Navigate', icon: 'goal', action: () => onTabChange('goal')       },
    { id: 'nav-finance',    label: 'Go to Finance',     category: 'Navigate', icon: 'finance', action: () => onTabChange('finance')    },
    { id: 'nav-progress',   label: 'Go to Progress',    category: 'Navigate', icon: 'progress', action: () => onTabChange('progress')   },
    { id: 'nav-style',      label: 'Go to Style',       category: 'Navigate', icon: 'style', action: () => onTabChange('style')      },
    { id: 'nav-essentials', label: 'Go to Supplies',    category: 'Navigate', icon: 'essentials', action: () => onTabChange('essentials') },
    { id: 'nav-lists',      label: 'Go to Lists',       category: 'Navigate', icon: 'lists', action: () => onTabChange('lists')      },
    { id: 'nav-focus',      label: 'Go to Focus',       category: 'Navigate', icon: 'focus', action: () => onTabChange('focus')      },
    { id: 'nav-vault',      label: 'Go to Vault',       category: 'Navigate', icon: 'vault', action: () => onTabChange('vault')      },
    { id: 'nav-settings',   label: 'Go to Settings',    category: 'Navigate', icon: 'settings', action: () => onTabChange('settings')  },

    // Actions
    { id: 'action-focus',   label: 'Start focus session',     category: 'Action', icon: 'focus', action: () => onTabChange('focus')                                                                  },
    { id: 'action-mood',    label: 'Log mood',                category: 'Action', icon: 'mood', action: () => { onTabChange('progress'); }                                                          },
    { id: 'action-water',   label: 'Log water',               category: 'Action', icon: 'water', action: () => { onTabChange(screenForHealthSection('water')); }                                                          },
    { id: 'action-weekly',  label: 'Weekly Review (whole life)', category: 'Action', icon: 'review', action: () => window.dispatchEvent(new CustomEvent('valerie:weekly-review')) },
    { id: 'action-today',   label: "Today — everything due today", category: 'Action', icon: 'today', action: () => window.dispatchEvent(new CustomEvent('valerie:today')) },

    // Data backup / restore
    { id: 'data-export', label: 'Export all data (backup)', category: 'Data', icon: 'download', action: () => { const n = exportBackup(); toast(`Backup downloaded — ${n} keys saved`); } },
    { id: 'data-import', label: 'Restore from backup file',  category: 'Data', icon: 'upload', action: () => importBackup((ok, info) => toast(ok ? `Restored ${info} keys — reloading…` : `Restore failed: ${info}`, ok ? 'success' : 'sleep')) },

    // Theme switching
    { id: 'theme-obsidian', label: 'Theme: Obsidian', category: 'Theme', icon: 'theme', action: () => { applyTheme('obsidian'); const s = storage.get(STORAGE_KEYS.SETTINGS, {}); storage.set(STORAGE_KEYS.SETTINGS, { ...s, theme: 'obsidian' }); } },
    { id: 'theme-midnight', label: 'Theme: Midnight', category: 'Theme', icon: 'theme', action: () => { applyTheme('midnight'); const s = storage.get(STORAGE_KEYS.SETTINGS, {}); storage.set(STORAGE_KEYS.SETTINGS, { ...s, theme: 'midnight' }); } },
    { id: 'theme-ember',    label: 'Theme: Ember',    category: 'Theme', icon: 'theme', action: () => { applyTheme('ember');    const s = storage.get(STORAGE_KEYS.SETTINGS, {}); storage.set(STORAGE_KEYS.SETTINGS, { ...s, theme: 'ember'    }); } },
    { id: 'theme-phantom',  label: 'Theme: Phantom',  category: 'Theme', icon: 'theme', action: () => { applyTheme('phantom');  const s = storage.get(STORAGE_KEYS.SETTINGS, {}); storage.set(STORAGE_KEYS.SETTINGS, { ...s, theme: 'phantom'  }); } },
    { id: 'theme-arctic',   label: 'Theme: Arctic',   category: 'Theme', icon: 'theme', action: () => { applyTheme('arctic');   const s = storage.get(STORAGE_KEYS.SETTINGS, {}); storage.set(STORAGE_KEYS.SETTINGS, { ...s, theme: 'arctic'   }); } },
    { id: 'theme-crimson',  label: 'Theme: Crimson',  category: 'Theme', icon: 'theme', action: () => { applyTheme('crimson');  const s = storage.get(STORAGE_KEYS.SETTINGS, {}); storage.set(STORAGE_KEYS.SETTINGS, { ...s, theme: 'crimson'  }); } },
  ];
}

// ─── App-wide data search ──────────────────────────────────────────────────────
function searchAppData(query, onTabChange) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results = [];

  // Tasks
  try {
    const tasks = storage.get(STORAGE_KEYS.TASKS, []);
    tasks
      .filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(t => results.push({
        id: `task-${t.id}`,
        label: t.title,
        category: 'Task',
        icon: 'task',
        meta: t.priority,
        action: () => onTabChange('tasks'),
      }));
  } catch {}

  // Notes
  try {
    const notes = storage.get(STORAGE_KEYS.NOTES, []);
    notes
      .filter(n => n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(n => results.push({
        id: `note-${n.id}`,
        label: n.title || 'Untitled note',
        category: 'Note',
        icon: 'note',
        action: () => onTabChange('notes'),
      }));
  } catch {}

  // Calendar events
  try {
    const events = storage.get(STORAGE_KEYS.EVENTS, []);
    events
      .filter(e => e.title?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(e => results.push({
        id: `event-${e.id}`,
        label: e.title,
        category: 'Event',
        icon: 'event',
        meta: e.date,
        action: () => onTabChange('calendar'),
      }));
  } catch {}

  // Essentials
  try {
    const items = storage.get(STORAGE_KEYS.ESSENTIALS, []);
    items
      .filter(i => i.name?.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach(i => results.push({
        id: `ess-${i.id}`,
        label: i.name,
        category: 'Supply',
        icon: 'essentials',
        action: () => onTabChange('essentials'),
      }));
  } catch {}

  // Lists (books, shows, etc.)
  try {
    const listItems = storage.get(STORAGE_KEYS.LISTS, []);
    listItems
      .filter(i => i.title?.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach(i => results.push({
        id: `list-${i.id}`,
        label: i.title,
        category: i.category || 'List',
        icon: 'lists',
        action: () => onTabChange('lists'),
      }));
  } catch {}

  return results;
}

// ─── Fuzzy command filter ──────────────────────────────────────────────────────
function filterCommands(commands, query) {
  if (!query) return commands.slice(0, 8);
  const q = query.toLowerCase();
  return commands.filter(c =>
    c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );
}

// ─── Category colours ──────────────────────────────────────────────────────────
const CAT_COLORS = {
  Navigate: '#5b9cf6',
  Action:   'var(--accent)',
  Theme:    '#a064e6',
  Task:     '#e55a5a',
  Note:     '#4caf7d',
  Event:    '#f4a642',
  Essential: '#14b8a6',
  List:     '#5b9cf6',
};

// ─── CommandPalette component ──────────────────────────────────────────────────
export default function CommandPalette({ open, onClose, onTabChange }) {
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef(null);

  const staticCommands = buildStaticCommands(onTabChange);

  // Build combined results list
  const results = [
    ...filterCommands(staticCommands, query),
    ...(query.length >= 2 ? searchAppData(query, onTabChange) : []),
  ];

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Reset selection when results change
  useEffect(() => { setSelected(0); }, [query]);

  const handleKeyDown = useCallback((e) => {
    if (!open) return;
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[selected];
      if (item) { item.action(); onClose(); }
    }
  }, [open, results, selected, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        }}
      />

      {/* Palette container */}
      <div style={{
        position: 'fixed', top: '18%', left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 901, width: '100%', maxWidth: 580,
        padding: '0 16px',
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '0.5px solid var(--card-border)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}>

          {/* Search input */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px',
            borderBottom: results.length > 0 ? '0.5px solid var(--sidebar-divider)' : 'none',
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search commands, tabs, tasks, notes…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 15, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 0,
                }}
              >
                ×
              </button>
            )}
            <kbd style={{
              fontSize: 11, color: 'var(--text-muted)',
              background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
              borderRadius: 4, padding: '2px 6px',
            }}>
              esc
            </kbd>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {results.map((item, idx) => (
                <div
                  key={item.id}
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => { item.action(); onClose(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', cursor: 'pointer',
                    background: selected === idx ? 'var(--active-bg)' : 'none',
                    borderLeft: `2px solid ${selected === idx ? 'var(--accent)' : 'transparent'}`,
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                >
                  {/* Icon */}
                  <span style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0, color: selected === idx ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    <Icon name={item.icon} size={16} />
                  </span>

                  {/* Label */}
                  <span style={{
                    flex: 1, fontSize: 13.5,
                    color: selected === idx ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    {item.label}
                  </span>

                  {/* Meta (date, priority, etc.) */}
                  {item.meta && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.meta}
                    </span>
                  )}

                  {/* Category badge */}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                    color: CAT_COLORS[item.category] || 'var(--text-muted)',
                    background: (CAT_COLORS[item.category] || '#555') + '18',
                    padding: '2px 7px', borderRadius: 10,
                    textTransform: 'uppercase', flexShrink: 0,
                  }}>
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {results.length === 0 && query.length > 0 && (
            <div style={{
              padding: '24px 18px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              No results for "{query}"
            </div>
          )}

          {/* Footer hint */}
          <div style={{
            display: 'flex', gap: 16, padding: '9px 18px',
            borderTop: '0.5px solid var(--sidebar-divider)',
            background: 'var(--bg-panel)',
          }}>
            {[['', 'navigate'], ['', 'select'], ['esc', 'close']].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <kbd style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  background: 'var(--hover-bg)', border: '0.5px solid var(--card-border)',
                  borderRadius: 4, padding: '1px 5px',
                }}>{key}</kbd>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', opacity: 0.5 }}>
              Ctrl+K to toggle
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
