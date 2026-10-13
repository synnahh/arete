// trainPrefs.js — how you want Train to behave, saved in settings.train. Pure.
// Every choice has a default that matches how Train worked before, so an empty setting
// changes nothing.
//   effort       'rpe' (How hard? 6-10) | 'rir' (Reps left? 4-0) | 'off'. Stored the same way
//                (as RPE) so the next-weight engine reads one thing whichever you pick.
//   warmups      show the suggested warm-up ramp on barbell lifts
//   plates       show the per-side plate breakdown on barbell lifts
//   autoRest     start the rest timer when you tick a set
//   defaultSets  number of sets to recommend when the program does not say (null = automatic)
//   restSound    a short tone when a rest ends (off by default; only while the app is open)
//   restVibrate  a buzz when a rest ends (Android; iPhone web apps have no vibration API)

export const TRAIN_DEFAULTS = { effort: 'rpe', warmups: true, plates: true, autoRest: true, defaultSets: null, restSound: false, restVibrate: true };
export const EFFORT_MODES = ['rpe', 'rir', 'off'];

export function cleanTrainPrefs(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const n = Math.round(Number(r.defaultSets));
  return {
    effort: EFFORT_MODES.includes(r.effort) ? r.effort : TRAIN_DEFAULTS.effort,
    warmups: r.warmups !== false,
    plates: r.plates !== false,
    autoRest: r.autoRest !== false,
    defaultSets: n >= 1 && n <= 8 ? n : null,
    restSound: r.restSound === true,
    restVibrate: r.restVibrate !== false,
  };
}

/** The RPE values shown as buttons, with the text each carries in the chosen scale. */
export function effortOptions(mode) {
  if (mode === 'off') return [];
  return [6, 7, 8, 9, 10].map(rpe => ({ rpe, text: mode === 'rir' ? String(10 - rpe) : String(rpe) }));
}

export const effortLabel = (mode) => (mode === 'rir' ? 'Reps left?' : 'How hard?');

/** A rest time set on one exercise, if valid (15-600 s), else null. */
export const ownRest = (ex) => { const n = Number(ex?.restSeconds); return n >= 15 && n <= 600 ? Math.round(n) : null; };
