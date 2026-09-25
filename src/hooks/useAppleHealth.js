//  useAppleHealth  reads Apple Health data written by Health Auto Export 
// Health Auto Export writes to Firestore: health_sync/{YYYY-MM-DD}
// Each doc contains the metrics selected in the app config.

import { useState, useEffect } from 'react';
import { supabase } from '../supabase/supabase.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

function parseDoc(data) {
  if (!data) return null;

  // Health Auto Export field names vary by metric selection  normalise them
  return {
    // Steps
    steps: data.steps?.qty ?? data.stepCount?.qty ?? data.HKQuantityTypeIdentifierStepCount ?? null,

    // Heart rate (avg bpm)
    heartRate: data.heartRate?.avg ?? data.heart_rate?.avg ?? null,

    // HRV (ms)
    hrv: data.heartRateVariabilitySDNN?.avg ?? data.hrv?.avg ?? null,

    // Active energy (kcal)
    activeEnergy: data.activeEnergy?.qty ?? data.activeEnergyBurned?.qty ?? null,

    // Sleep  Health Auto Export nests sleep under sleepAnalysis
    sleep: data.sleepAnalysis
      ? {
          duration:   data.sleepAnalysis.asleep ?? null,      // minutes
          efficiency: data.sleepAnalysis.efficiency ?? null,  // 0-100
          bedTime:    data.sleepAnalysis.bedtime ?? null,
          wakeTime:   data.sleepAnalysis.wake ?? null,
          stages: {
            deep:  data.sleepAnalysis.deep  ?? null,
            rem:   data.sleepAnalysis.rem   ?? null,
            core:  data.sleepAnalysis.core  ?? null,
            awake: data.sleepAnalysis.awake ?? null,
          },
        }
      : null,

    // Weight (kg)
    weight: data.bodyMass?.qty ?? data.weight?.qty ?? null,

    // Body fat %
    bodyFat: data.bodyFatPercentage?.qty ?? data.bodyFat?.qty ?? null,

    // Resting heart rate
    restingHeartRate: data.restingHeartRate?.qty ?? null,

    // Respiratory rate
    respiratoryRate: data.respiratoryRate?.avg ?? null,

    // Blood oxygen %
    bloodOxygen: data.oxygenSaturation?.avg ?? null,

    // Raw source timestamp
    _syncedAt: data._exportDate ?? data.date ?? null,
  };
}

export function useAppleHealth() {
  const [data,      setData]      = useState(null);
  const [lastSync,  setLastSync]  = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let channel;
    let alive = true;

    async function fetchLatest() {
      const { data: rows, error } = await supabase
        .from('health_sync')
        .select('*')
        .order('sync_date', { ascending: false })
        .limit(2);

      if (!alive) return;
      setLoading(false);

      if (error || !rows?.length) { setConnected(false); setData(null); return; }

      setConnected(true);
      const parsed = parseDoc(rows[0]);
      if (!parsed.sleep && rows.length > 1) {
        const prev = parseDoc(rows[1]);
        if (prev?.sleep) parsed.sleep = prev.sleep;
      }
      setData(parsed);
      setLastSync(rows[0].sync_date ?? rows[0].id);
    }

    fetchLatest();

    channel = supabase.channel('health_sync_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_sync' }, fetchLatest)
      .subscribe();

    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
  }, []);

  return { data, lastSync, connected, loading };
}


