import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mapHealthExport } from '../../supabase/functions/_shared/healthMap.js';

// The sample in docs/health-ingest-sample.json is what the deployment checklist sends with curl,
// so it must map to the numbers the checklist says to expect.
describe('health-ingest sample payload', () => {
  const sample = JSON.parse(readFileSync(new URL('../../docs/health-ingest-sample.json', import.meta.url), 'utf8'));
  const r = mapHealthExport(sample);

  it('gives one day with the summed steps and a heart-rate summary', () => {
    expect(Object.keys(r.days)).toEqual(['2026-01-15']);
    expect(r.days['2026-01-15'].steps).toBe(5500);
    expect(r.days['2026-01-15'].heartRate).toEqual({ avg: 68, min: 52, max: 121 });
  });
  it('gives one weigh-in with body fat attached', () => {
    expect(r.weights).toHaveLength(1);
    expect(r.weights[0]).toMatchObject({ date: '2026-01-15', time: '07:15', weight: 71.2, bodyFat: 19.4 });
  });
  it('gives one night of sleep', () => {
    expect(r.sleep).toHaveLength(1);
    expect(r.sleep[0]).toMatchObject({ date: '2026-01-15', duration: 414, bedTime: '23:40', wakeTime: '07:05' });
  });
});
