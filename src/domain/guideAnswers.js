// guideAnswers.js — Rob's answers to the coach intake, taken from his own guides so he
// does not have to type them. Source: "Complete Personal Appearance, Fitness and Skin
// Guide" (25 Sep 2026) and "Robert Pearson Complete Appearance and Physique Guide"
// (21 Sep 2026). Only what the guides state is here. His birth date is NOT in them
// (only "21 years"), so it stays empty for him to fill in.
//
// Choices where the guides give a number or a plain fact:
//  - weight 71 kg, height 180 cm (5 ft 11 in), male, 21, ~19-20% body fat (self-estimate).
//  - five training days, full gym access, detrained and returning, 5-9k steps a day.
//    "Lightly active" rather than "moderately": both guides open at about 2,300 kcal as a
//    trial intake, and the formula at the light factor gives about 2,390 maintenance, which
//    matches. Choosing moderate would put maintenance near 2,690, far from the guides. The
//    coach recalibrates from two weeks of weigh-ins and food logs either way.
//  - the guide's own five-day frame-priority week: Upper A, Lower A, Upper B, Lower B, Upper C.
//  - the goal Rob chose after reading them: build muscle as fast as possible in a deficit.
//    A deficit of about 12% (roughly 300 kcal, the guides' mini-cut size) and protein
//    around 2.2 g/kg (the guides use 145 to 160 g at 71 kg).

import { customFieldsFromPreset } from './goals.js';

export const ROB_GUIDE_ANSWERS = {
  goal: 'custom',
  ...customFieldsFromPreset('muscleDeficit'),
  sex: 'male',
  heightCm: 180,
  weightKg: 71,
  activity: 'light',
  experience: 'intermediate',
  days: 5,
  splitTemplate: 'upperFrame',
  equipment: 'gym',
  limitations: 'Right shoulder pops on heavy overhead pressing. No heavy vertical pressing; use neutral-grip, landmine and incline work and stop anything painful.',
  foodAvoid: '',
  sleepHours: 8.5,
  skinType: 'sensitive',
  skinConcerns: ['redness'],
  skinAvoid: 'fragrance, retinal, salicylic acid',
};
