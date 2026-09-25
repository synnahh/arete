//  useSleepSchedule  bedtime dimming + reminder system 
// Reads bedtime/wakeTime from Firebase meta/sleep_schedule.
// Dims the interface and fires voice + toast reminders as bedtime approaches.

import { useEffect, useRef, useState } from 'react';
import { useDocument }                  from '../supabase/useDocument.js';
import { speakText }                    from '../ai/speech.js';

function timeToMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function useSleepSchedule(settings) {
  const { data: schedule, save } = useDocument('sleep_schedule', 'sleep_schedule', null);

  const [dimLevel,    setDimLevel]    = useState(0);   // 01
  const [isSleepTime, setIsSleepTime] = useState(false);

  const reminded30Ref  = useRef(false);
  const remindedBedRef = useRef(false);
  const prevSleepRef   = useRef(false);

  useEffect(() => {
    const bedtime  = schedule?.bedtime  || null;
    const wakeTime = schedule?.wakeTime || null;

    if (!bedtime) {
      setDimLevel(0);
      setIsSleepTime(false);
      window.__valerieSleepMode = false;
      return;
    }

    // Delay first tick by 5s after schedule loads to avoid jarring black flash on startup
    let firstTickDone = false;
    const tick = () => { try { _tick(); } catch (e) { console.warn('[useSleepSchedule] tick error:', e); } };
    const _tick = () => {
      const now = new Date();
      const nowMins  = now.getHours() * 60 + now.getMinutes();
      const bedMins  = timeToMins(bedtime);
      const wakeMins = timeToMins(wakeTime || '07:00');

      // Sanity guard  bedtime must be in a reasonable evening/night window (18:0003:00).
      // Prevents garbage Firebase data or testing artifacts from blacking out the screen at noon.
      const bedH = Math.floor(bedMins / 60);
      if (bedH >= 3 && bedH < 18) {
        setDimLevel(0);
        setIsSleepTime(false);
        window.__valerieSleepMode = false;
        return;
      }

      // Guard against bedtime === wakeTime (would create a 24h sleep window and
      // cause an infinite reminder loop draining ElevenLabs quota every 30s).
      if (bedMins === wakeMins) {
        setDimLevel(0);
        setIsSleepTime(false);
        window.__valerieSleepMode = false;
        return;
      }

      // Sleep window spans midnight when bedtime > wake (e.g. 23:00   07:00)
      const inSleepWindow = bedMins > wakeMins
        ? nowMins >= bedMins || nowMins < wakeMins
        : nowMins >= bedMins && nowMins < wakeMins;

      if (inSleepWindow) {
        setDimLevel(1);
        setIsSleepTime(true);
        window.__valerieSleepMode = true;

        // Reset reminder flags so they fire again next day
        reminded30Ref.current  = false;
        remindedBedRef.current = false;
        prevSleepRef.current   = true;
        return;
      }

      // We're awake  reset sleep mode
      if (prevSleepRef.current) {
        setDimLevel(0);
        setIsSleepTime(false);
        window.__valerieSleepMode = false;
        prevSleepRef.current = false;
        return;
      }

      setIsSleepTime(false);
      window.__valerieSleepMode = false;

      // Minutes until bedtime (always positive, handles midnight wrap)
      const minsUntilBed = bedMins > nowMins
        ? bedMins - nowMins
        : 1440 - nowMins + bedMins;

      if (minsUntilBed <= 0) {
        setDimLevel(1);
        if (!remindedBedRef.current) {
          remindedBedRef.current = true;
          window.dispatchEvent(new CustomEvent('valerie:toast', {
            detail: { message: 'Bedtime. Wind down and rest, Sir.', type: 'sleep' },
          }));
          speakText('Bedtime, Sir. Time to rest.', settings?.voice || {}).catch(() => {});
        }
      } else if (minsUntilBed <= 30) {
        // Fade from 0   0.75 over the 30-minute window
        setDimLevel((1 - minsUntilBed / 30) * 0.75);
        if (!reminded30Ref.current) {
          reminded30Ref.current = true;
          const mins = Math.round(minsUntilBed);
          window.dispatchEvent(new CustomEvent('valerie:toast', {
            detail: { message: `Bedtime in ${mins} minute${mins !== 1 ? 's' : ''}.`, type: 'sleep' },
          }));
          speakText(`Heads up, Sir  bedtime in ${mins} minutes.`, settings?.voice || {}).catch(() => {});
        }
      } else {
        setDimLevel(0);
        // Reset reminder flags once we're safely outside the window
        if (minsUntilBed > 31) {
          reminded30Ref.current  = false;
          remindedBedRef.current = false;
        }
      }
    };

    // Delay first evaluation by 5s so Firebase-loaded schedule doesn't black-flash on startup
    const initTimer = setTimeout(tick, 5000);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(id);
      window.__valerieSleepMode = false;
    };
  }, [schedule, settings]);

  return { schedule, save, dimLevel, isSleepTime };
}

