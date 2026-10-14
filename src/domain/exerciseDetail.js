// exerciseDetail.js — the grip and set-up for each exercise in the database, so a Train card says
// exactly how to hold the bar or handle and how to set up, not only the lift's name. Pure data.
// The form cue itself lives in exerciseDb.js; this adds the two things the cue usually leaves out.
//
// Row format: name | grip | set-up. A blank grip means hands do not hold a load (planks, squats on
// the back are given a grip anyway because the hands still matter).
import { findExercise } from './exerciseDb.js';

const ROWS = `
Bench Press|Overhand, hands just outside shoulder width (index fingers about on the rings), thumbs wrapped|Eyes under the bar, feet flat, slight arch, unrack with straight arms
Incline Bench Press|Overhand, just outside shoulder width, thumbs wrapped|Bench at 30 degrees, eyes under the bar, shoulder blades pinned
Decline Bench Press|Overhand, just outside shoulder width|Legs hooked under the pads, have a spotter or use safeties
Close-Grip Bench Press|Overhand, hands about shoulder width (not touching), thumbs wrapped|Elbows tucked close to the ribs, bar to the lower chest
DB Bench Press|Overhand, palms facing your feet, dumbbells in line with the mid-chest|Kick the dumbbells up off the knees as you lie back
Incline DB Press|Overhand, palms forward or turned slightly in|Bench at 30 degrees, dumbbells start at the upper chest
Low-Incline Neutral-Grip DB Press|Neutral, palms facing each other|Bench at 15 to 30 degrees, elbows about 30 degrees from the body
Decline DB Press|Overhand, palms facing your feet|Legs hooked, press over the lower chest
Chest Press Machine|Horizontal handles, overhand; vertical handles, neutral|Seat height so the handles line up with the mid-chest
Incline Chest Press Machine|Overhand on the horizontal handles|Seat so the handles line up with the upper chest
Pec Deck|Neutral on the handles, or forearms on the pads|Seat so the arms are level with the shoulders
Cable Fly|Neutral, palms facing each other|Pulleys at shoulder height, one step forward, staggered stance
Low-to-High Cable Fly|Underhand-neutral, palms facing up and in|Pulleys at the lowest setting, finish at eye height
DB Fly|Neutral, palms facing each other|Lie flat, dumbbells above the chest, slight bend in the elbows
Push-ups|Hands flat, just wider than the shoulders, fingers forward|Body straight from head to heels, glutes squeezed
Incline Push-ups|Hands on the bench edge, shoulder width|Body straight, the higher the bench the easier
Decline Push-ups|Hands flat, shoulder width|Feet on a bench, body straight
Dips|Neutral on the parallel bars|Start at the top with straight arms, lean slightly forward for chest
Overhead Press|Overhand, just outside shoulder width, forearms vertical|Bar on the front of the shoulders, glutes and abs braced
Push Press|Overhand, just outside shoulder width|Bar on the front of the shoulders, feet hip width
Seated DB Shoulder Press|Overhand, palms forward (or turned slightly in for cranky shoulders)|Bench upright or one notch back
DB Shoulder Press|Overhand, palms forward or slightly in|Standing, feet hip width, ribs down
Arnold Press|Start palms facing you, finish palms forward|Seated, back supported
Shoulder Press Machine|Overhand or neutral handles|Seat so the handles start at shoulder height
Lateral Raise|Neutral or palms down, light grip, pinky slightly up|Slight forward lean, elbows soft
Cable Lateral Raise|Single handle, neutral|Pulley at the lowest setting, cable across the front or behind the body
Front Raise|Overhand, palms down|Standing tall, no swinging
Reverse Pec Deck|Neutral or overhand on the handles|Face the pad, arms level with the shoulders
Rear Delt Fly|Neutral, palms facing each other|Hinge forward until the chest is near parallel
Face Pulls|Rope, thumbs pointing back toward you (overhand on the rope)|Pulley at forehead height, pull to the eyes and turn the hands out
Pike Push-ups|Hands flat, shoulder width|Hips high, head goes between the hands
Handstand Push-up|Hands flat, just wider than the shoulders|Against a wall, head lowers to a cushion
Triceps Pushdown|Straight or V-bar, overhand, hands close|Elbows pinned to the sides, slight forward lean
Rope Pushdown|Rope, neutral (thumbs up)|Elbows pinned, spread the rope at the bottom
Overhead Triceps Extension|One dumbbell, both hands cupping the top plate|Seated or standing, elbows pointing up
Triceps Press Machine|Neutral or overhand handles|Elbows level with the handles, upper arms still
Cable Overhead Triceps Extension|Rope, neutral|Face away from a low or mid pulley, elbows by the head
Skull Crushers|EZ bar or bar, overhand, hands about shoulder width or narrower|Lie flat, lower to the forehead or just behind the head
Triceps Kickback|Neutral, palm facing in|Hinge forward, upper arm against the side
Bench Dips|Hands on the bench edge, fingers forward|Feet out in front, shoulders down
Diamond Push-ups|Hands together under the chest, thumbs and index fingers touching|Body straight, elbows close
Deadlift|Double overhand, or mixed (one under, one over) when heavy; hands just outside the legs|Bar over the mid-foot, shins to the bar, hips set, chest up
Sumo Deadlift|Double overhand or mixed, hands inside the knees, shoulder width|Wide stance, toes out, knees pushed out over the toes
Trap Bar Deadlift|Neutral on the high or low handles, centred|Stand in the middle of the bar, hips back, chest up
Rack Pull|Double overhand or mixed, just outside the legs|Bar set just below or above the knee
Barbell Row|Overhand, just outside shoulder width (underhand for more biceps)|Hinge to about 45 degrees, bar to the lower ribs
Pendlay Row|Overhand, just outside shoulder width|Back flat near parallel, bar from the floor each rep
T-Bar Row|Neutral close-grip handle, or wide overhand handles|Chest on the pad if it has one, pull to the stomach
One-arm DB Row|Neutral, palm facing in|Hand and knee on a bench, pull to the hip
Chest-Supported Row|Neutral or overhand|Chest on an incline bench, arms hanging straight
Seated Cable Row|V-handle neutral (close), or wide bar overhand|Knees soft, sit tall, pull to the stomach
Machine Row|Neutral or overhand handles|Chest on the pad, seat so the handles line up with the lower chest
Lat Pulldown|Overhand, about 1.5 times shoulder width, thumbs over or around the bar|Thighs locked under the pad, slight lean back, pull to the upper chest
Close-Grip Lat Pulldown|V-handle, neutral (palms facing)|Thighs under the pad, pull to the upper chest
Straight-Arm Pulldown|Straight bar or rope, overhand, shoulder width|Step back, slight hinge, arms nearly straight
Pull-ups|Overhand, just outside shoulder width|Dead hang to start, chin over the bar
Chin-ups|Underhand (palms facing you), shoulder width|Dead hang to start, chest to the bar
Assisted Pull-ups|Overhand, just outside shoulder width|Knees on the pad, pick the assistance that allows full reps
Inverted Row|Overhand, just outside shoulder width|Bar at hip height in a rack, body straight
Barbell Shrug|Overhand, shoulder width (straps if the grip fails first)|Stand tall, arms straight
DB Shrug|Neutral, dumbbells at the sides|Stand tall, arms straight
Superman Hold|No grip; arms straight out in front|Face down, lift arms and legs
Back Extension|Hands crossed on the chest or behind the head|Pad just below the hip bones
Barbell Curl|Underhand, shoulder width|Elbows at the sides, no swinging
EZ-Bar Curl|Underhand on the angled grips (easier on the wrists)|Elbows at the sides
DB Curl|Underhand, palms forward; turn the pinky up at the top|Standing or seated, elbows still
Hammer Curl|Neutral, palms facing each other (thumbs up)|Elbows at the sides
Incline DB Curl|Underhand, palms forward|Bench at 45 to 60 degrees, arms hanging straight
Preacher Curl|Underhand (EZ bar on the angled grips or handles)|Armpits snug on the pad
Cable Curl|Straight bar or EZ attachment, underhand|Pulley at the lowest setting, elbows still
Concentration Curl|Underhand|Seated, elbow braced on the inner thigh
Wrist Curl|Underhand, forearms on the thighs or bench|Wrists hang off the edge
Reverse Curl|Overhand, shoulder width|Elbows at the sides
Farmer's Carry|Neutral, crush the handles|Stand tall, short quick steps
Barbell Squat|Overhand, as narrow as the shoulders allow, thumbs wrapped|Bar on the upper back (high bar) or rear delts (low bar), feet shoulder width, toes slightly out
Front Squat|Clean grip (fingertips under the bar, elbows high) or arms crossed|Bar on the front of the shoulders, elbows up
Goblet Squat|Cup the top of one dumbbell with both hands, against the chest|Feet shoulder width, elbows inside the knees at the bottom
Hack Squat|Neutral on the handles|Shoulders under the pads, feet mid-platform
Smith Machine Squat|Overhand, just outside the shoulders|Feet slightly in front of the bar
Leg Press|Neutral on the side handles|Feet shoulder width mid-platform, lower back stays on the pad
Leg Extension|Neutral on the side handles|Knee in line with the pivot, pad above the ankles
Walking Lunges|Neutral, dumbbells at the sides|Long step, back knee near the floor
Reverse Lunge|Neutral, dumbbells at the sides|Step back, front shin vertical
Bulgarian Split Squat|Neutral, dumbbells at the sides|Back foot on a bench, front foot far enough forward
Split Squat|Neutral, dumbbells at the sides|Staggered stance, drop straight down
Step-ups|Neutral, dumbbells at the sides|Box at knee height, drive through the front heel
Sissy Squat|One hand on a support|Up on the toes, knees travel forward
Wall Sit|Hands on the thighs or crossed|Back flat on the wall, thighs parallel
Bodyweight Squat|Hands together in front|Feet shoulder width
Jump Squat|Hands together or swinging|Feet shoulder width, land softly
Romanian Deadlift|Overhand, just outside the legs (straps if needed)|Start standing, soft knees, push the hips back
DB Romanian Deadlift|Neutral or overhand, dumbbells in front of the thighs|Soft knees, push the hips back
Stiff-Leg Deadlift|Overhand, just outside the legs|Legs nearly straight, bar from the floor
Good Morning|Overhand, bar on the upper back|Soft knees, hinge at the hips
Lying Leg Curl|Neutral on the handles|Knees just off the bench edge, pad above the heels
Seated Leg Curl|Neutral on the handles|Knee in line with the pivot, thigh pad snug
Nordic Curl|Hands ready to catch you|Heels anchored, lower slowly
Single-Leg Romanian Deadlift|Neutral, dumbbell in the hand opposite the working leg|Soft standing knee, hips square
Kettlebell Swing|Overhand on the handle, both hands|Hinge, hike the bell back, snap the hips
Hip Thrust|Overhand, just outside the hips|Upper back on a bench edge, pad on the bar
DB Hip Thrust|Both hands holding the dumbbell on the hips|Upper back on a bench edge
Glute Bridge|Hands flat by the sides|Lying, feet hip width, heels close
Single-Leg Glute Bridge|Hands flat by the sides|One foot down, other knee to the chest
Cable Kickback|Ankle strap, hand on the machine|Slight hinge, kick straight back
Hip Abduction Machine|Neutral on the handles|Sit tall or lean forward slightly for more glute
Frog Pumps|Hands by the sides|Soles together, knees out
Standing Calf Raise|Neutral on the handles|Balls of the feet on the edge, full stretch at the bottom
Seated Calf Raise|Hands on the pad|Pad snug above the knees
Calf Raise|One hand on a wall for balance|Balls of the feet on a step
Donkey Calf Raise|Neutral on the handles|Hips under the pad, legs nearly straight
Plank|Forearms down, fists or palms flat|Elbows under the shoulders, body straight
Side Plank|Forearm down|Elbow under the shoulder, hips high
Crunch|Fingertips at the temples or hands crossed|Feet flat, lower back down
Cable Crunch|Rope, neutral, hands by the head|Kneel facing the pulley, curl the ribs to the hips
Hanging Leg Raise|Overhand, shoulder width (straps if the grip fails)|Dead hang, no swinging
Hanging Knee Raise|Overhand, shoulder width|Dead hang, knees to the chest
Reverse Crunch|Hands flat by the sides or holding a bench|Knees bent, roll the hips up
Ab Wheel Rollout|Overhand on the wheel handles|Start on the knees, ribs down
Russian Twist|Clasped hands or holding a plate|Seated, lean back, feet up for harder
Bicycle Crunch|Fingertips at the temples|Lower back down
Dead Bug|Arms straight up|Lower back pressed into the floor
Mountain Climbers|Hands flat, under the shoulders|Push-up position, hips level
Pallof Press|Single handle, both hands, neutral|Side-on to the pulley at chest height
Band Pull-Apart|Overhand, shoulder width|Arms straight in front at shoulder height
Band Face Pull|Overhand on the band ends|Band anchored at face height
Kettlebell Goblet Squat|Hold the bell by the horns, against the chest|Feet shoulder width
Turkish Get-Up|Bell in one hand, wrist straight, arm locked|Start lying, eyes on the bell throughout
`;

const DETAIL = new Map(ROWS.trim().split('\n').map((line) => {
  const [name, grip, setup] = line.split('|').map(s => s.trim());
  return [name.toLowerCase(), { grip: grip || null, setup: setup || null }];
}));

const lc = (s) => String(s || '').trim().toLowerCase();

/**
 * Everything worth showing on a card about how to do an exercise: { grip, setup, cue, equipment }.
 * Library entries are matched to the database by name; a custom exercise gets its own note only.
 */
export function exerciseDetail(name) {
  const d = DETAIL.get(lc(name)) || null;
  const db = findExercise(name);
  if (!d && !db) return null;
  return { grip: d?.grip ?? null, setup: d?.setup ?? null, cue: db?.cue ?? null, equipment: db?.equipment ?? null };
}

/** Database names with no grip and set-up written yet (for the test that keeps the two in step). */
export function missingDetail(names) {
  return names.filter(n => !DETAIL.has(lc(n)));
}
