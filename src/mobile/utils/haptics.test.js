import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { haptics, installTapHaptics } from './haptics.js';

// Minimal stand-ins so the logic runs without a DOM library.
class FakeEl {
  constructor({ disabled = false, quiet = false, matches = true } = {}) { this.disabled = disabled; this.quiet = quiet; this.matches = matches; }
  getAttribute() { return null; }
  closest(sel) {
    if (sel === '[data-no-haptic]') return this.quiet ? this : null;
    return this.matches ? this : null;
  }
}

describe('haptics', () => {
  let vibrate;
  beforeEach(() => {
    vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate, userAgent: 'test' });
    vi.stubGlobal('Element', FakeEl);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the vibration API where it exists', () => {
    haptics.tap();
    expect(vibrate).toHaveBeenCalledWith([8]);
  });

  it('never throws when nothing is available', () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    expect(() => haptics.success()).not.toThrow();
  });

  it('buzzes once for a real button press and not for disabled, opted-out or non-button taps', () => {
    let handler;
    const root = { addEventListener: (_t, fn) => { handler = fn; }, removeEventListener: vi.fn() };
    const stop = installTapHaptics(root);
    handler({ target: new FakeEl() });
    handler({ target: new FakeEl({ disabled: true }) });
    handler({ target: new FakeEl({ quiet: true }) });
    handler({ target: new FakeEl({ matches: false }) });
    handler({ target: null });
    expect(vibrate).toHaveBeenCalledTimes(1);
    stop();
    expect(root.removeEventListener).toHaveBeenCalled();
  });
});
