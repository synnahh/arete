import { toLocalDateKey } from './localDate.js';
// backup.js — one-tap full backup & restore of all VALERIE data.
// Exports every localStorage key (the local mirror of all Supabase collections +
// settings) to a JSON file, and restores from one. A safety net for a daily-driver
// app that runs your whole life.

export function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) data[k] = localStorage.getItem(k);
  }
  const payload = {
    _valerie_backup: true,
    version: 2,
    exportedAt: new Date().toISOString(),
    keyCount: Object.keys(data).length,
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `valerie-backup-${toLocalDateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return payload.keyCount;
}

// Opens a file picker, restores keys into localStorage, then reloads so every hook
// re-reads fresh data. onDone(success, messageOrCount).
export function importBackup(onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        if (!data || typeof data !== 'object') throw new Error('Not a valid VALERIE backup file');
        let n = 0;
        Object.entries(data).forEach(([k, v]) => {
          if (typeof v === 'string') { localStorage.setItem(k, v); n++; }
        });
        onDone?.(true, n);
        setTimeout(() => window.location.reload(), 700);
      } catch (err) {
        onDone?.(false, err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
