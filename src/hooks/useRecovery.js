// useRecovery — today's readiness and sleep debt from the synced sleep and
// workout collections (rules: src/domain/recovery.js). Re-computes when the
// sleep-need setting changes.
import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { readiness, DEFAULT_SLEEP_NEED_H } from '../domain/recovery.js';
import { useHealthHistory } from './useHealthHistory.js';

const needFrom = (settings) => {
  const n = Number(settings?.sleepNeedHours);
  return n >= 5 && n <= 11 ? n : DEFAULT_SLEEP_NEED_H;
};

export function useRecovery() {
  const { items: sleepRows = [] } = useCollection('sleep_data', STORAGE_KEYS.SLEEP);
  const { items: workoutLogs = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const health = useHealthHistory(35); // resting heart rate and HRV from the Fitbit / phone
  const [need, setNeed] = useState(() => needFrom(storage.get(STORAGE_KEYS.SETTINGS, {})));

  useEffect(() => {
    const onChange = (e) => setNeed(needFrom(e.detail));
    window.addEventListener('valerie:settings-changed', onChange);
    return () => window.removeEventListener('valerie:settings-changed', onChange);
  }, []);

  const today = toLocalDateKey(new Date());
  const result = useMemo(
    () => readiness({ sleepRows, workoutLogs, health: health.rows, today, need }),
    [sleepRows, workoutLogs, health.rows, today, need]
  );
  return { ...result, need };
}
