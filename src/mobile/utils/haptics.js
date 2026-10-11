// ─── haptics.js — tap feedback for the phone app ─────────────────────────────
// Android: navigator.vibrate. iPhone has no vibration API, but Safari 17.4+ plays
// a light haptic whenever a native switch checkbox is toggled by a tap, so we
// toggle a hidden one. That only works inside a user gesture (a click or touch
// handler), which is where every call here happens. Older iOS and browsers with
// neither path do nothing.

let label = null;

function iosSwitch() {
  if (typeof document === 'undefined') return null;
  if (label && document.body.contains(label)) return label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

function buzz(pattern, repeats = 1) {
  try {
    if (navigator.vibrate) { navigator.vibrate(pattern); return; }
    if (!isIOS()) return;
    const l = iosSwitch();
    if (!l) return;
    for (let i = 0; i < repeats; i++) setTimeout(() => l.click(), i * 70);
  } catch { /* haptics are never worth an error */ }
}

export const haptics = {
  tap:     () => buzz([8]),
  light:   () => buzz([4]),
  success: () => buzz([10, 40, 10], 2),
  error:   () => buzz([30, 20, 30], 3),
  heavy:   () => buzz([20]),
};

/**
 * One light tap for every real button press, the way native apps feel. Skips
 * disabled controls and anything that opts out with data-no-haptic. Returns a
 * function that removes the listener.
 */
export function installTapHaptics(root = document) {
  const onClick = (e) => {
    const el = e.target instanceof Element ? e.target.closest('button, [role="button"], [role="tab"], a[href], summary') : null;
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-no-haptic]')) return;
    haptics.light();
  };
  root.addEventListener('click', onClick, true);
  return () => root.removeEventListener('click', onClick, true);
}
