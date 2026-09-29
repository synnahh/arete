// confirm.js — which assistant actions need your OK, and what to tell you.
//
// The assistant logs things you say to it (water, food, sleep, tasks) straight
// away: asking every time would defeat talking to it. Changing a SETTING is
// different: it can move your targets or switch features, so it waits for an
// Apply on a card. Credential-like keys and structured values are refused
// outright, never offered.

const KEY_OK = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
// Anything that smells like a secret or a lock. Settings sync strips credentials
// anyway; the assistant should never be the one to touch them.
const SECRET_KEY = /key|token|secret|password|passcode|pin|auth|credential|twilio|sid|api/i;

export const needsConfirmation = (action) => action?.type === 'toggleSetting' || action?.type === 'changeSetting';

/** Is this key one the assistant may propose changing? */
export function isSafeSettingKey(key) {
  return typeof key === 'string' && KEY_OK.test(key) && !SECRET_KEY.test(key);
}

/** Only plain values: no objects, arrays or long text that could carry a payload. */
export function isSafeSettingValue(value) {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 120;
  return false;
}

/**
 * What to show on the card, or null when the action must not run at all.
 * `current` = the stored settings, to say what is changing from.
 */
export function describeAction(action, current = {}) {
  if (!needsConfirmation(action) || !isSafeSettingKey(action.key)) return null;
  const from = current?.[action.key];
  const show = (v) => (v === undefined ? 'not set' : typeof v === 'string' ? `"${v}"` : String(v));
  if (action.type === 'toggleSetting') {
    if (from !== undefined && typeof from !== 'boolean') return null; // toggling a non-boolean makes no sense
    return { title: `Turn "${action.key}" ${from ? 'off' : 'on'}?`, detail: `Currently ${from ? 'on' : 'off'}.` };
  }
  if (!isSafeSettingValue(action.value)) return null;
  return { title: `Change "${action.key}" to ${show(action.value)}?`, detail: `Currently ${show(from)}.` };
}
