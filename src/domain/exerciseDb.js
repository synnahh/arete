// exerciseDb.js — a searchable exercise database: what each lift trains, the
// equipment it needs and one line on how to do it. Pure data + helpers.
//
// Separate from exercisePick.js on purpose: that file picks a sensible push/pull/
// legs week from a small curated set; this one is the whole reference you search
// and add single exercises from. Adding one creates an ordinary Exercise Library
// entry, so Train, progression and the muscle map treat it like any other lift.
//
// Row format: name | main muscle | helpers | equipment | kind | cue
// Equipment: barbell dumbbell machine cable bar bodyweight kettlebell band
// Cues are short form reminders, not coaching. Starting weights are cautious guesses.

const ROWS = `
Bench Press|chest|triceps,shoulders|barbell|compound|Shoulder blades pinned back, bar to mid-chest, press up and slightly back.
Incline Bench Press|chest|shoulders,triceps|barbell|compound|Bench at 30 degrees, bar to upper chest, elbows about 45 degrees from the body.
Decline Bench Press|chest|triceps|barbell|compound|Slight decline, lower to the lower chest, keep the wrists stacked.
Close-Grip Bench Press|triceps|chest,shoulders|barbell|compound|Hands just inside shoulder width, elbows tucked, press through the triceps.
DB Bench Press|chest|triceps,shoulders|dumbbell|compound|Lower until the elbows are just below the bench, press the dumbbells together at the top.
Incline DB Press|chest|shoulders,triceps|dumbbell|compound|Bench at 30 degrees, control the lowering, do not clang the weights.
Low-Incline Neutral-Grip DB Press|chest|shoulders,triceps|dumbbell|compound|Bench at 15 to 30 degrees, palms facing each other, elbows slightly tucked, no forced deep stretch.
Decline DB Press|chest|triceps|dumbbell|compound|Slight decline, press in an arc over the lower chest.
Chest Press Machine|chest|triceps,shoulders|machine|compound|Seat so the handles line up with mid-chest, push without shrugging.
Incline Chest Press Machine|chest|shoulders,triceps|machine|compound|Handles at upper chest height, shoulder blades back.
Pec Deck|chest||machine|isolation|Elbows slightly bent, squeeze the pads together in front of the chest.
Cable Fly|chest|shoulders|cable|isolation|Soft elbows, hug a barrel, pause when the hands meet.
Low-to-High Cable Fly|chest|shoulders|cable|isolation|Start low, sweep up to eye height to hit the upper chest.
DB Fly|chest|shoulders|dumbbell|isolation|Slight elbow bend, stretch wide, stop when you feel the chest stretch.
Push-ups|chest|triceps,shoulders|bodyweight|compound|Body in one line, elbows about 45 degrees, chest to the floor.
Incline Push-ups|chest|triceps,shoulders|bodyweight|compound|Hands on a bench, easier than the floor version.
Decline Push-ups|chest|shoulders,triceps|bodyweight|compound|Feet raised, targets the upper chest and shoulders.
Dips|chest|triceps,shoulders|bar|compound|Lean slightly forward, lower until the upper arms are parallel, press up.
Overhead Press|shoulders|triceps|barbell|compound|Squeeze glutes, press straight up, head through at the top.
Push Press|shoulders|triceps,quads|barbell|compound|Small knee dip, drive the bar overhead with the legs and arms.
Seated DB Shoulder Press|shoulders|triceps|dumbbell|compound|Back supported, press the dumbbells overhead without arching.
DB Shoulder Press|shoulders|triceps|dumbbell|compound|Dumbbells at ear height, press up and slightly in.
Arnold Press|shoulders|triceps|dumbbell|compound|Rotate the palms from facing you to facing forward as you press.
Shoulder Press Machine|shoulders|triceps|machine|compound|Seat so the handles start at shoulder height, press without locking out hard.
Lateral Raise|shoulders||dumbbell|isolation|Lead with the elbows, raise to shoulder height, lower slowly.
Cable Lateral Raise|shoulders||cable|isolation|Constant tension through the whole range, raise to shoulder height.
Front Raise|shoulders|chest|dumbbell|isolation|Raise to eye height with a slight elbow bend, no swinging.
Reverse Pec Deck|shoulders|back|machine|isolation|Lead with the elbows, squeeze the rear delts, avoid shrugging.
Rear Delt Fly|shoulders|back|dumbbell|isolation|Hinge forward, raise out to the sides with soft elbows.
Face Pulls|shoulders|back,traps|cable|isolation|Pull to the forehead with the elbows high, rotate the hands apart.
Pike Push-ups|shoulders|triceps|bodyweight|compound|Hips high in an upside-down V, lower the head toward the floor.
Handstand Push-up|shoulders|triceps|bodyweight|compound|Against a wall, lower under control, press straight up.
Triceps Pushdown|triceps||cable|isolation|Elbows pinned to the sides, extend fully, control the way up.
Rope Pushdown|triceps||cable|isolation|Split the rope at the bottom, elbows stay by your ribs.
Overhead Triceps Extension|triceps||dumbbell|isolation|Elbows pointing up, lower behind the head, extend fully.
Triceps Press Machine|triceps||machine|isolation|Elbows by the ribs, press down to full extension, control the way up.
Cable Overhead Triceps Extension|triceps||cable|isolation|Face away from the stack, elbows forward, stretch and extend.
Skull Crushers|triceps||barbell|isolation|Lower the bar toward the forehead with fixed elbows, extend.
Triceps Kickback|triceps||dumbbell|isolation|Upper arm parallel to the floor, straighten the elbow, squeeze.
Bench Dips|triceps|chest,shoulders|bodyweight|isolation|Hands on a bench behind you, lower until the elbows reach 90 degrees.
Diamond Push-ups|triceps|chest|bodyweight|compound|Hands close under the chest, elbows brush the ribs.
Deadlift|back|hamstrings,glutes,traps|barbell|compound|Bar over mid-foot, flat back, push the floor away, lock out with the glutes.
Sumo Deadlift|back|glutes,quads,hamstrings|barbell|compound|Wide stance, hands inside the knees, chest up, spread the floor.
Trap Bar Deadlift|quads|back,glutes,traps|barbell|compound|Stand inside the bar, neutral grip, push the floor away.
Rack Pull|back|traps,glutes|barbell|compound|Bar from knee height, lock out hips and squeeze the upper back.
Barbell Row|back|biceps,traps|barbell|compound|Hinged at the hips, pull to the lower ribs, keep the back flat.
Pendlay Row|back|biceps,traps|barbell|compound|Bar returns to the floor each rep, explosive pull to the chest.
T-Bar Row|back|biceps,traps|machine|compound|Chest supported or hinged, pull the handle to the chest.
One-arm DB Row|back|biceps|dumbbell|compound|Hand and knee on the bench, pull the elbow to the hip.
Chest-Supported Row|back|biceps,traps|dumbbell|compound|Lie face down on an incline bench, row with no momentum.
Seated Cable Row|back|biceps,traps|cable|compound|Sit tall, pull to the stomach, squeeze the shoulder blades.
Machine Row|back|biceps|machine|compound|Chest against the pad, pull the elbows back.
Lat Pulldown|back|biceps|cable|compound|Lean back slightly, pull the bar to the upper chest, elbows down.
Close-Grip Lat Pulldown|back|biceps|cable|compound|Neutral handle, pull to the chest, full stretch at the top.
Straight-Arm Pulldown|back||cable|isolation|Arms nearly straight, sweep the bar to the thighs with the lats.
Pull-ups|back|biceps|bar|compound|Start from a dead hang, chin over the bar, lower fully.
Chin-ups|back|biceps|bar|compound|Palms toward you, chest to the bar, controlled lowering.
Assisted Pull-ups|back|biceps|machine|compound|Use the least assistance you can still do clean reps with.
Inverted Row|back|biceps|bodyweight|compound|Body in a plank under a bar, pull the chest to the bar.
Barbell Shrug|traps|forearms|barbell|isolation|Lift the shoulders straight up, pause, no rolling.
DB Shrug|traps|forearms|dumbbell|isolation|Shrug toward the ears, hold the top for a beat.
Superman Hold|back|glutes|bodyweight|isolation|Lie face down, lift arms and legs, hold and breathe.
Back Extension|back|glutes,hamstrings|bodyweight|isolation|Hinge at the hips, rise to a straight line, do not hyperextend.
Barbell Curl|biceps|forearms|barbell|isolation|Elbows by the sides, curl without swinging, lower slowly.
EZ-Bar Curl|biceps|forearms|barbell|isolation|Angled grip is easier on the wrists, full range.
DB Curl|biceps|forearms|dumbbell|isolation|Supinate as you curl, squeeze at the top.
Hammer Curl|biceps|forearms|dumbbell|isolation|Neutral grip, targets the brachialis and forearms.
Incline DB Curl|biceps||dumbbell|isolation|Bench at 45 degrees, arms hang back for a deep stretch.
Preacher Curl|biceps||machine|isolation|Upper arms on the pad, do not drop into the bottom.
Cable Curl|biceps||cable|isolation|Constant tension, keep the elbows still.
Concentration Curl|biceps||dumbbell|isolation|Elbow braced on the inner thigh, curl and squeeze.
Wrist Curl|forearms||dumbbell|isolation|Forearms on the thighs, curl the wrists up and lower slowly.
Reverse Curl|forearms|biceps|barbell|isolation|Overhand grip, curl with the knuckles up.
Farmer's Carry|forearms|traps,abs|dumbbell|compound|Tall posture, heavy dumbbells, short fast steps.
Barbell Squat|quads|glutes,hamstrings|barbell|compound|Bar on the upper back, brace, knees track the toes, hit parallel or below.
Front Squat|quads|glutes,abs|barbell|compound|Elbows high, upright torso, bar on the front delts.
Goblet Squat|quads|glutes|dumbbell|compound|Hold the dumbbell at the chest, sit between the knees.
Hack Squat|quads|glutes|machine|compound|Feet low and forward for the quads, full depth.
Smith Machine Squat|quads|glutes|machine|compound|Feet slightly forward, control the descent.
Leg Press|quads|glutes,hamstrings|machine|compound|Feet shoulder width, lower until the knees are about 90 degrees, no lock-out slam.
Leg Extension|quads||machine|isolation|Pause and squeeze at the top, lower slowly.
Walking Lunges|quads|glutes,hamstrings|dumbbell|compound|Long step, back knee near the floor, push through the front heel.
Reverse Lunge|quads|glutes|dumbbell|compound|Step back, vertical shin at the bottom, drive through the front foot.
Bulgarian Split Squat|quads|glutes|dumbbell|compound|Rear foot on a bench, lower straight down, front foot flat.
Split Squat|quads|glutes|dumbbell|compound|Staggered stance, lower straight down, front foot flat, hold a support if needed.
Step-ups|quads|glutes|dumbbell|compound|Whole foot on the box, drive up with the front leg only.
Sissy Squat|quads||bodyweight|isolation|Lean back with the knees forward, advanced quad isolation.
Wall Sit|quads|glutes|bodyweight|isolation|Thighs parallel to the floor, back flat on the wall.
Bodyweight Squat|quads|glutes|bodyweight|compound|Chest up, sit back and down, drive through the whole foot.
Jump Squat|quads|glutes,calves|bodyweight|compound|Squat then jump, land softly into the next rep.
Romanian Deadlift|hamstrings|glutes,back|barbell|compound|Soft knees, push the hips back, bar slides down the thighs.
DB Romanian Deadlift|hamstrings|glutes,back|dumbbell|compound|Hinge until you feel the hamstring stretch, flat back.
Stiff-Leg Deadlift|hamstrings|glutes,back|barbell|compound|Nearly straight legs, hinge from the hips, deep hamstring stretch.
Good Morning|hamstrings|back,glutes|barbell|compound|Bar on the back, hinge forward with a flat spine, light weight.
Lying Leg Curl|hamstrings||machine|isolation|Hips down, curl the heels to the glutes, slow lowering.
Seated Leg Curl|hamstrings||machine|isolation|Press the thighs into the pad, full range.
Nordic Curl|hamstrings||bodyweight|isolation|Kneel, lower as slowly as you can, catch with the hands.
Single-Leg Romanian Deadlift|hamstrings|glutes|dumbbell|compound|Balance on one leg, hinge until the torso is parallel to the floor.
Kettlebell Swing|glutes|hamstrings,back|kettlebell|compound|Hinge, snap the hips, the bell floats to chest height.
Hip Thrust|glutes|hamstrings|barbell|compound|Upper back on a bench, drive the hips up, ribs down, squeeze at the top.
DB Hip Thrust|glutes|hamstrings|dumbbell|compound|Dumbbell across the hips, pause at the top.
Glute Bridge|glutes|hamstrings|bodyweight|isolation|Feet flat, drive the hips up, squeeze the glutes.
Single-Leg Glute Bridge|glutes|hamstrings|bodyweight|isolation|One foot planted, hips level as you lift.
Cable Kickback|glutes|hamstrings|cable|isolation|Hip hinged slightly, kick back without arching the lower back.
Hip Abduction Machine|glutes||machine|isolation|Push the knees apart, controlled return.
Frog Pumps|glutes||bodyweight|isolation|Soles together, lift the hips in quick short reps.
Standing Calf Raise|calves||machine|isolation|Full stretch at the bottom, pause at the top.
Seated Calf Raise|calves||machine|isolation|Targets the soleus, slow tempo with a pause.
Calf Raise|calves||bodyweight|isolation|On a step edge, rise onto the toes, lower below the step.
Donkey Calf Raise|calves||machine|isolation|Hinged forward, deep stretch and full rise.
Plank|abs|shoulders|bodyweight|isolation|Straight line from head to heels, brace the abs, do not sag.
Side Plank|abs||bodyweight|isolation|Stack the feet, hips up, hold the line.
Crunch|abs||bodyweight|isolation|Curl the ribs toward the pelvis, lower with control.
Cable Crunch|abs||cable|isolation|Kneel and curl the spine down, hips stay still.
Hanging Leg Raise|abs||bar|isolation|Hang from the bar, raise the legs with no swinging, tuck the pelvis.
Hanging Knee Raise|abs||bar|isolation|Easier than straight legs, curl the pelvis up.
Reverse Crunch|abs||bodyweight|isolation|Lie flat, curl the knees toward the chest and lift the hips a little, lower slowly.
Ab Wheel Rollout|abs|shoulders|bodyweight|isolation|Brace, roll out only as far as you can keep the back flat.
Russian Twist|abs||bodyweight|isolation|Lean back slightly, rotate from the ribs, not the arms.
Bicycle Crunch|abs||bodyweight|isolation|Slow alternating elbow to opposite knee.
Dead Bug|abs||bodyweight|isolation|Lower back pressed down, extend opposite arm and leg slowly.
Mountain Climbers|abs|shoulders,quads|bodyweight|compound|Plank position, drive the knees in quickly.
Pallof Press|abs||cable|isolation|Resist rotation as you press the handle out and back.
Band Pull-Apart|shoulders|back|band|isolation|Arms straight, pull the band to the chest, squeeze the shoulder blades.
Band Face Pull|shoulders|back,traps|band|isolation|Pull toward the forehead with the elbows high.
Kettlebell Goblet Squat|quads|glutes|kettlebell|compound|Hold the bell at the chest, elbows inside the knees at the bottom.
Turkish Get-Up|shoulders|abs,glutes|kettlebell|compound|Slow and controlled, eyes on the bell throughout.
`;

const DAY_OF = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  back: 'pull', biceps: 'pull', traps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', abs: 'legs',
};

// The recovery map and Muscle Ranking use ten muscle ids; traps count as back and
// abs are not tracked there.
const TRACKED = { traps: 'back' };
const TRACKED_IDS = new Set(['chest', 'shoulders', 'triceps', 'back', 'biceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves']);

const START = { barbell: 20, dumbbell: 8, machine: 20, cable: 10, kettlebell: 8, bar: 0, bodyweight: 0, band: 0 };
const INC = { barbell: 2.5, dumbbell: 1, machine: 5, cable: 2.5, kettlebell: 2, bar: 0, bodyweight: 0, band: 0 };

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const EXERCISE_DB = ROWS.trim().split('\n').map((line) => {
  const [name, muscle, helpers, equipment, kind, cue] = line.split('|');
  return {
    id: `db-${slug(name)}`,
    name, muscle,
    helpers: helpers ? helpers.split(',') : [],
    equipment, kind, cue,
    day: DAY_OF[muscle],
  };
});

export const DB_MUSCLES = ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'traps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves'];
export const DB_EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bar', 'bodyweight', 'kettlebell', 'band'];

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Search by name words, optionally narrowed by muscle and equipment. Name matches
 * rank by how early and how completely the words match; with no query the list is
 * returned in database order. Capped by `limit`.
 */
export function searchExercises(query = '', { muscle = null, equipment = null, limit = 40 } = {}) {
  const words = norm(query).split(' ').filter(Boolean);
  const out = [];
  for (const ex of EXERCISE_DB) {
    if (muscle && ex.muscle !== muscle && !ex.helpers.includes(muscle)) continue;
    if (equipment && ex.equipment !== equipment) continue;
    if (!words.length) { out.push({ ex, score: 0 }); continue; }
    const name = norm(ex.name);
    const hay = `${name} ${ex.muscle} ${ex.helpers.join(' ')} ${ex.equipment}`;
    if (!words.every(w => hay.includes(w))) continue;
    let score = 0;
    for (const w of words) {
      if (name.startsWith(w)) score += 3;
      else if (name.split(' ').some(t => t.startsWith(w))) score += 2;
      else if (name.includes(w)) score += 1;
    }
    if (ex.muscle && words.includes(ex.muscle)) score += 1;
    out.push({ ex, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.ex);
}

/** The ten tracked muscles an exercise trains (main first), for the recovery map. */
export function trackedMuscles(ex) {
  const all = [ex.muscle, ...(ex.helpers || [])].map(m => TRACKED[m] || m).filter(m => TRACKED_IDS.has(m));
  return [...new Set(all)];
}

/** Look an exercise up by name (case-insensitive); null if it is not in the database. */
const BY_NAME = new Map(EXERCISE_DB.map(e => [e.name.toLowerCase(), e]));
export const findExercise = (name) => BY_NAME.get(String(name || '').trim().toLowerCase()) || null;

/** A video search for how to do an exercise (opens in a new tab; nothing is stored or downloaded). */
export const demoUrl = (name) => {
  const n = String(name || '').trim();
  return n ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${n} exercise form`)}` : null;
};

/** A database exercise as an Exercise Library entry (same shape Train already reads). */
export function toLibraryEntry(ex) {
  const bw = ex.equipment === 'bodyweight' || ex.equipment === 'bar' || ex.equipment === 'band';
  const compound = ex.kind === 'compound';
  return {
    id: ex.id, name: ex.name, day: ex.day, bodyweight: bw,
    gym: ex.equipment === 'machine' || ex.equipment === 'cable' ? 'commercial' : 'both',
    startingWeight: START[ex.equipment] ?? 0,
    repsMin: compound ? 6 : 10, repsMax: compound ? 10 : 15,
    increment: INC[ex.equipment] ?? 0,
  };
}
