// useTasks — the one way UI surfaces read and write tasks.
//
// Replaces dashboard code that wrote straight to localStorage. Those writes
// never reached Supabase and were overwritten by the next sync fetch, so a
// task ticked or added from the desktop or iOS home screen was silently lost.
//
// - Reads go through useCollection (Supabase + realtime + local mirror) and are
//   normalised, so legacy {title, completed} rows display correctly.
// - Toggling is optimistic: the tick shows immediately and reverts if the
//   write fails (useCollection already raises an error toast).

import { useState, useMemo, useCallback } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { normalizeTasks, makeTask } from '../domain/tasks.js';

export function useTasks() {
  const { items, add, update, remove, synced } = useCollection('tasks', STORAGE_KEYS.TASKS);
  const [optimistic, setOptimistic] = useState({}); // id -> done

  const tasks = useMemo(
    () => normalizeTasks(items).map(t => (t.id in optimistic ? { ...t, done: optimistic[t.id] } : t)),
    [items, optimistic],
  );

  const toggle = useCallback(async (task) => {
    if (!task?.id) return;
    const next = !task.done;
    setOptimistic(o => ({ ...o, [task.id]: next }));
    try {
      await update(task.id, { done: next, completedAt: next ? new Date().toISOString() : null });
    } finally {
      setOptimistic(({ [task.id]: _, ...rest }) => rest);
    }
  }, [update]);

  const addTask = useCallback((text, extra = {}) => {
    const t = String(text ?? '').trim();
    if (!t) return Promise.resolve(null);
    return add(makeTask({ text: t, ...extra }));
  }, [add]);

  return { tasks, toggle, addTask, remove, synced };
}
