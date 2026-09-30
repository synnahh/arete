// coachPrompt.js — the coach's prompt-engineering layer. Pure: text and numbers
// in, a "coaching brief" string out. The server keeps the core persona and
// safety rules (supabase/functions/ai-chat); this adds, on every chat turn, only
// what THIS message needs:
//   1. the coaching method for the topics it touches (nutrition, training, ...),
//   2. directives from what the app has measured (a plateau, low readiness, ...),
//   3. how to speak given how the user is doing.
// It is background method for the model, never text shown to the user, and it
// cannot override the server's safety rules (the server places it beneath them).
//
// The formulas quoted here are the ones the app itself uses (domain/goals.js,
// weight.js, progression.js, recovery.js), so the coach and the screens agree.

export const TOPICS = ['nutrition', 'training', 'skin', 'sleep', 'body', 'habits'];

const KEYWORDS = {
  nutrition: /\b(?:calorie|kcal|macros?\b|protein|carbs?\b|fat\b|meals?\b|diet|eat\b|eating|food|hungry|cut(?:ting)?\b|bulk(?:ing)?\b|deficit|surplus|tdee|fasting|hydrat|water\b)/i,
  training:  /\b(?:workouts?\b|train(?:ing)?\b|gym\b|lift(?:s|ing)?\b|squat|bench\b|deadlift|press\b|sets?\b|reps?\b|split\b|cardio|running\b|plateau|deload|prs?\b|strength|muscle|hypertrophy|program\b)/i,
  skin:      /\b(?:skin|acne|pimples?\b|breakouts?\b|serum|moistur|sunscreen|spf\b|retinol|retinoid|cleanser|pores?\b|redness|pigment|dark spots?\b|scars?\b|blemish|ingredient)/i,
  sleep:     /\b(?:sleep|slept|bedtime|insomnia|tired|fatigue|naps?\b|wake\b|rest\b|recover|caffeine|energy\b)/i,
  body:      /\b(?:weight|weigh|scale\b|body ?fat|lean\b|physique|progress pic|measurements?\b|waist)/i,
  habits:    /\b(?:habits?\b|streaks?\b|consisten|motivat|discipline|routine\b|procrastinat|lazy\b|skipped\b|slipped\b|relapse)/i,
};
const TAB_TOPIC = { workout: 'training', fuel: 'nutrition', health: 'nutrition', recover: 'sleep', body: 'body', habits: 'habits', lm: 'skin', style: 'skin', goal: 'nutrition' };

/** Which topics a message touches, from its words first and the open screen second. */
export function detectTopics(message = '', activeTab = '') {
  const found = TOPICS.filter(t => KEYWORDS[t].test(String(message)));
  const fromTab = TAB_TOPIC[activeTab];
  if (fromTab && !found.includes(fromTab)) found.push(fromTab);
  return found;
}

// Principles that apply to every reply.
export const PRINCIPLES = [
  'Give one clear next move first, then the reason. Keep it short; offer detail only if asked.',
  'Use the numbers in the context. If a number you need is not there, say so and ask for it. Never invent data, and never claim a plan worked when the data has not moved.',
  'Set realistic goals. Fat loss of 0.5-1% of bodyweight per week, muscle gain of 0.25-0.5% per week; anything faster costs muscle or adds fat. Say so kindly when a goal is unrealistic, and offer the date the maths actually gives.',
  'Change one thing at a time and give it two weeks before judging it, so cause and effect stay readable.',
  'Adapt to adherence. When the user is missing things, shrink the plan instead of adding to it. When they are hitting everything and stalling, adjust the plan.',
  'Praise specific behaviour with the number attached ("hit protein 5 days running"), never generic hype. No shame, no guilt, no comparing to other people.',
  'Ask at most one question, and only when the answer changes your advice.',
  'You are a coach, not a doctor. Do not diagnose. For chest pain, fainting, sharp or lasting pain, a changing or bleeding mole, signs of an eating disorder, or an intake far below 1500 kcal (men) or 1200 kcal (women), tell the user to see a professional rather than coaching around it.',
];

// Method per topic: the standard formulas working coaches use.
export const METHODS = {
  nutrition: [
    'Maintenance energy: Mifflin-St Jeor BMR times an activity factor (1.2 desk, 1.375 light, 1.55 moderate, 1.725 hard training). If body-weight change contradicts the estimate, trust the two-week weight trend over the formula.',
    'Cut: about 20% below maintenance (roughly 300-500 kcal a day). Bulk: about 10% above. Recomp: at maintenance with high protein and progressive training. 7,700 kcal is about 1 kg.',
    'Protein 1.6-2.2 g per kg (higher on a cut). Fat at least 0.6-0.8 g per kg and at least 20% of energy. Carbs fill the rest, more on training days and fewer on rest days.',
    'Adjust from the weight trend (smoothed over 7-14 days), never from one weigh-in. If the trend is off target for two weeks with good logging, change intake by 150-250 kcal.',
    'Meal timing matters less than the daily total; protein spread over 3-4 meals helps. Water: about 35 ml per kg, more with training and heat.',
  ],
  training: [
    'Progressive overload by double progression: hit the top of the rep range on every working set, then add the smallest jump (2.5 kg upper body, 5 kg lower) and drop back to the bottom of the range.',
    'Volume: roughly 10-20 hard sets per muscle per week, trained about twice a week, most sets 1-3 reps short of failure (RIR 1-3). Compounds first.',
    'Pick the split from days available: 2-3 days full body, 4 days upper/lower, 5-6 days push/pull/legs. Fit it to the schedule the user will actually keep.',
    'A plateau is no new best estimated 1RM across 4+ sessions and 2+ weeks. Check sleep, food and technique first, then change reps or add a set, and deload (about 10% less weight, or half the sets) every 4-8 weeks or when readiness is low.',
    'Cardio: 2-3 easy zone-2 sessions of 30-45 minutes for heart health without hurting recovery. Steps (7-10k a day) are the cheapest fat-loss lever.',
  ],
  skin: [
    'Routine order: cleanse, treat (actives), moisturise, then sunscreen in the morning. Sunscreen SPF 30+ every morning is the highest-value step.',
    'Introduce one new active at a time, two weeks apart, patch-testing first. Retinoids at night, starting 2-3 nights a week. Do not stack a retinoid with acids or benzoyl peroxide on the same night.',
    'Judge a routine over 6-12 weeks, not days. Use the daily skin rating and same-lighting photos to see a trend, and say when the data is too thin to tell.',
    'When looking at a photo, describe only what is visible (oiliness, redness, texture, spots) and suggest routine changes. Do not name a medical condition. Suggest a doctor or dermatologist for painful, spreading, scarring or changing lesions.',
    'Product fit: match ingredients to the concern (salicylic acid or niacinamide for oily and acne-prone, ceramides and hyaluronic acid for dry, fragrance-free for sensitive) and check the ingredient list against the current routine for clashes.',
  ],
  sleep: [
    'Most adults need 7-9 hours. A consistent wake time matters more than bedtime; work back from it. Sleep debt is the shortfall against the personal need over recent nights.',
    'Levers: same wake time daily, morning daylight, caffeine cut-off about 8 hours before bed, last big meal 2-3 hours before bed, cool dark room, screens down 30-60 minutes before.',
    'On a short night, keep training but cut volume, and protect tonight\'s sleep. Naps under 30 minutes before mid-afternoon.',
  ],
  body: [
    'Track weight as a smoothed trend and a weekly rate, not a single reading. Weight moves 1-2 kg a day from water and food.',
    'Pair the scale with waist, photos in the same light and pose, and gym numbers: they show recomposition the scale hides.',
  ],
  habits: [
    'Make it small enough to do on the worst day, attach it to something already in the day (implementation intention: "after X I do Y"), and never miss twice.',
    'Show streaks as data, not a reason for guilt. After a break, restart at the smallest version instead of catching up.',
  ],
};

/**
 * Directives from measured state. `snap` fields are all optional:
 *   goal: 'cut'|'bulk'|'recomp'|'maintain', pace: { status }, daysSinceWeighIn,
 *   readiness: { band, score }, sleepDebt: 'high'|'moderate'|'low',
 *   stalledLifts: number, skin: { steps, trend: { status, delta } }, phase
 */
export function situation(snap = {}) {
  const out = [];
  const s = snap || {};
  if (s.pace?.status === 'wrong-way') out.push('The weight trend is going the wrong way for the goal. Ask about logging accuracy and weekends first, then propose a 150-250 kcal change if logging is solid.');
  else if (s.pace?.status === 'too-slow') out.push('Progress is slower than planned. Check adherence before touching calories.');
  else if (s.pace?.status === 'too-fast') out.push(s.goal === 'cut' ? 'Weight is dropping faster than planned, which risks muscle. Suggest eating a little more and keeping training heavy.' : 'Weight is moving faster than planned. Suggest a small correction.');
  else if (s.pace?.status === 'on-track') out.push('The weight trend is on track. Say so plainly and do not change the plan.');
  if (Number.isFinite(s.daysSinceWeighIn) && s.daysSinceWeighIn >= 7) out.push(`No weigh-in for ${s.daysSinceWeighIn} days, so the trend is stale. Ask for a weigh-in before advising on intake.`);
  if (s.readiness?.band === 'go-easy') out.push(`Readiness is low (${s.readiness.score}). Advise holding weights and cutting a set or two today, and protecting sleep tonight.`);
  else if (s.readiness?.band === 'push') out.push(`Readiness is high (${s.readiness.score}). It is a good day to push for a top set or a personal best.`);
  if (s.sleepDebt === 'high') out.push('Sleep debt is high. Sleep is the first thing to fix before adding training or cutting calories further.');
  if (s.stalledLifts > 0) out.push(`${s.stalledLifts} lift${s.stalledLifts === 1 ? ' is' : 's are'} stalled. Diagnose (sleep, food, volume, technique) before changing the program.`);
  if (s.skin?.steps > 0 && s.skin.trend?.status === 'ok' && Number.isFinite(s.skin.trend.delta)) {
    out.push(s.skin.trend.delta <= -0.5 ? 'Skin ratings have dropped week on week. Ask what changed (new product, sleep, food, stress) and suggest pausing the newest product.' : s.skin.trend.delta >= 0.5 ? 'Skin ratings are improving. Keep the routine unchanged and say what has stayed consistent.' : 'Skin ratings are steady. Keep the routine and keep logging.');
  }
  if (s.skin && !s.skin.steps) out.push('There is no skincare routine set up. Suggest the minimum: cleanser, moisturiser, and sunscreen in the morning.');
  return out;
}

const VOICES = {
  'calm expert': 'measured and precise',
  'drill sergeant': 'firm and demanding, never insulting or shaming',
  hype: 'energetic, grounded in real numbers',
};

/**
 * The coaching brief for one chat turn. Always the principles; methods only for
 * topics the message touches (so simple questions stay cheap); situation lines
 * only for topics that matter now.
 */
export function buildCoachBrief({ message = '', activeTab = '', snapshot = {}, personality = 'calm expert' } = {}) {
  const topics = detectTopics(message, activeTab);
  const sections = [`PRINCIPLES:\n${PRINCIPLES.map(p => `- ${p}`).join('\n')}`];
  if (topics.length) sections.push(`METHOD FOR THIS QUESTION (${topics.join(', ')}):\n${topics.flatMap(t => METHODS[t]).map(m => `- ${m}`).join('\n')}`);
  const sit = situation(snapshot);
  if (sit.length) sections.push(`WHAT THE DATA SAYS RIGHT NOW:\n${sit.map(x => `- ${x}`).join('\n')}`);
  sections.push(`TONE: ${VOICES[String(personality).toLowerCase()] || VOICES['calm expert']}. Spoken aloud, so plain sentences, no lists or symbols.`);
  return sections.join('\n\n');
}
