// nextMoves.js — "what should I do next?": a short, ranked list built from what
// the app already knows today. Pure: a snapshot in, moves out. The hook that
// gathers the snapshot is hooks/useNextMoves.js and the card is
// components/NextMoves.jsx.
//
// Each move: { id, priority, title, why, tab } where `tab` is a screen id.
// Times matter: the same protein total is fine at noon and behind at 6 pm, so
// nothing about eating or habits fires early in the day.
//
// snapshot: {
//   hour,                                       // local hour 0-23
//   targets: { kcal, protein } | null,
//   eaten: { calories, protein },
//   water: { advice } | null,                   // waterAdvice() result
//   training: { isTrainingDay, trainedToday, label, readiness } | null,
//   supplies: { due: [{ name, daysToReorder, status }], expiring: [{ name, daysLeft }] },
//   habits: { done, total } | null,
//   weight: { daysSinceWeighIn, hasGoal } | null,
//   sleep: { debtHours, status, bedtime } | null,
//   skin: { amDone, amTotal, pmDone, pmTotal } | null,
//   fast: { done, elapsedH, targetHours } | null,
//   steps: { count, goal } | null,               // from Apple Health sync

// }

const MAX_MOVES = 5;
const list = (names, n = 2) => names.slice(0, n).join(', ') + (names.length > n ? ` and ${names.length - n} more` : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function nextMoves(snap = {}) {
  const hour = Number.isFinite(snap.hour) ? snap.hour : 12;
  const out = [];
  const add = (id, priority, title, why, tab) => out.push({ id, priority, title, why, tab });

  // Running out beats everything: it is the one thing that cannot be caught up later.
  const due = (snap.supplies?.due || []).filter(x => x.daysToReorder <= 0);
  if (due.length) {
    const soonest = [...due].sort((a, b) => a.daysToReorder - b.daysToReorder)[0];
    add('reorder', 95, `Reorder ${list(due.map(x => x.name))}`,
      soonest.status === 'out' ? `${soonest.name} has run out.` : `${soonest.name} is past its order-by date, so it will run out before a delivery lands.`, 'essentials');
  }

  const expired = (snap.supplies?.expiring || []).filter(x => x.daysLeft < 0);
  if (expired.length) add('expired', 60, `${list(expired.map(x => x.name))} ${expired.length > 1 ? 'are' : 'is'} past ${expired.length > 1 ? 'their' : 'its'} use-by date`, 'Replace it, or check the label before using it again.', 'essentials');

  const t = snap.training;
  if (t?.isTrainingDay && !t.trainedToday) {
    const r = t.readiness?.status === 'ok' ? t.readiness : null;
    if (r?.band === 'go-easy') {
      add('train-easy', hour >= 16 ? 78 : 70, `${t.label || 'Training'} today, but go lighter`, `Readiness is ${r.score}. Hold your weights, cut a set or two, and protect tonight's sleep.`, 'workout');
    } else if (hour >= 16) {
      add('train', 76, `${t.label || 'Training'} is still to do today`, r ? `Readiness is ${r.score}: ${r.label.toLowerCase()}.` : 'Get it in before the evening gets away.', 'workout');
    } else if (hour >= 6) {
      add('train', 55, `${t.label || 'Training'} today`, r ? `Readiness is ${r.score}: ${r.label.toLowerCase()}.` : 'Your plan for today is ready in Train.', 'workout');
    }
  }

  if (snap.fast?.done) add('fast-done', 62, `Your ${snap.fast.targetHours} h fast is done`, `${Math.floor(snap.fast.elapsedH)} hours in. Break it with protein first.`, 'fuel');

  const kcalNow = Number(snap.eaten?.calories) || 0;
  if (snap.targets && hour >= 12 && kcalNow === 0 && !snap.fast) {
    add('log-food', 68, 'Nothing logged yet today', 'Copy yesterday or quick-add so today has a record.', 'fuel');
  }
  if (snap.targets?.protein && hour >= 13 && kcalNow > 0) {
    const expected = snap.targets.protein * Math.min(1, Math.max(0, (hour - 7) / 14));
    const behind = Math.round(expected - (Number(snap.eaten?.protein) || 0));
    if (behind >= 25) add('protein', 65, `Protein is about ${behind} g behind pace`, 'Chicken, eggs, Greek yoghurt or a shake would close it.', 'fuel');
  }
  if (snap.targets?.kcal && hour >= 20 && kcalNow > 0 && kcalNow < snap.targets.kcal * 0.6) {
    add('under-eaten', 50, `Only ${kcalNow} of ${snap.targets.kcal} kcal logged`, 'Log anything you missed, or eat something before bed if you are really under.', 'fuel');
  }

  const w = snap.water?.advice;
  if (w?.status === 'behind') add('water', 52, 'Drink some water', w.message, 'fuel');

  const s = snap.sleep;
  if (s && s.status === 'high') add('sleep-debt', 58, `Sleep debt is ${s.debtHours} h`, `Aim to be in bed by ${s.bedtime || '22:00'} tonight.`, 'recover');

  if (snap.weight?.hasGoal && (snap.weight.daysSinceWeighIn == null || snap.weight.daysSinceWeighIn >= 4)) {
    add('weigh-in', 45, 'Log a weigh-in', snap.weight.daysSinceWeighIn == null ? 'No weight logged yet, so the trend and goal date cannot start.' : `Last one was ${plural(snap.weight.daysSinceWeighIn, 'day')} ago. The trend needs regular readings.`, 'body');
  }

  const st = snap.steps;
  if (st && st.goal > 0 && Number.isFinite(st.count) && hour >= 17 && st.count < st.goal * 0.6) {
    add('steps', 44, 'Steps are behind', `${st.count.toLocaleString('en-AU')} of ${st.goal.toLocaleString('en-AU')} so far. A 20 minute walk adds about 2,000.`, 'coachtoday');
  }

  const h = snap.habits;
  if (h && h.total > 0 && hour >= 18 && h.done < h.total) {
    add('habits', 48, `${plural(h.total - h.done, 'habit')} left today`, 'Tick them off before bed to keep your streaks.', 'habits');
  }

  const k = snap.skin;
  if (k && k.amTotal > 0 && hour >= 7 && hour < 12 && k.amDone < k.amTotal) {
    add('skin-am', 47, 'Morning skincare not done', `${k.amDone} of ${k.amTotal} steps ticked. Sunscreen is the one that matters most.`, 'lm');
  }
  if (k && k.pmTotal > 0 && hour >= 20 && k.pmDone < k.pmTotal) {
    add('skin-pm', 46, 'Night skincare not done', `${k.pmDone} of ${k.pmTotal} steps ticked.`, 'lm');
  }

  return out.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).slice(0, MAX_MOVES);
}
