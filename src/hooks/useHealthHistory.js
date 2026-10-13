// useHealthHistory — the last month of health_sync rows (one per day, written by the health-ingest
// function from Apple Health / Fitbit / the scale), kept live. Read-only. Rows come back as
// { date, data } for domain/metrics.js. A failed fetch keeps what was already shown.
import { useEffect, useState } from 'react';
import { supabase } from '../supabase/supabase.js';

export function useHealthHistory(days = 30) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data, error } = await supabase.from('health_sync').select('sync_date,data').order('sync_date', { ascending: false }).limit(days);
        if (!alive) return;
        if (!error && Array.isArray(data)) setRows(data.map(r => ({ date: String(r.sync_date).slice(0, 10), data: r.data || {} })));
      } catch { /* offline or no table yet: keep what we have */ }
      if (alive) setLoading(false);
    }
    load();
    const channel = supabase.channel(`health_history:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_sync' }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [days]);

  return { rows, loading };
}
