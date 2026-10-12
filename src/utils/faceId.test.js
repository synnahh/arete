import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map();

function setup(createImpl) {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  });
  vi.stubGlobal('location', { hostname: 'arete-dash.netlify.app' });
  vi.stubGlobal('navigator', { userAgent: 'iPhone', credentials: { create: createImpl } });
  vi.stubGlobal('window', {});
}

beforeEach(() => vi.unstubAllGlobals());

describe('Face ID enable', () => {
  it('stores the credential and clears any earlier decline on success', async () => {
    setup(async () => ({ rawId: new Uint8Array([1, 2, 3]).buffer }));
    store.set('arete_faceid_declined', '1');
    const f = await import('./faceId.js');
    const r = await f.enableFaceIdDetailed();
    expect(r).toEqual({ ok: true, error: null });
    expect(f.faceIdEnabled()).toBe(true);
    expect(f.faceIdDeclined()).toBe(false);
  });

  it('a cancelled or failed attempt is never recorded as declined, and says why', async () => {
    const err = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    setup(async () => { throw err; });
    const f = await import('./faceId.js');
    const r = await f.enableFaceIdDetailed();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cancelled or not allowed/i);
    expect(f.faceIdEnabled()).toBe(false);
    expect(f.faceIdDeclined()).toBe(false);
  });

  it('explains the common failures in plain words', async () => {
    const f = await import('./faceId.js');
    expect(f.explainFaceIdError({ name: 'SecurityError' })).toMatch(/web address/);
    expect(f.explainFaceIdError({ name: 'NotSupportedError' })).toMatch(/does not support/);
    expect(f.explainFaceIdError(null)).toMatch(/not available/);
    expect(f.explainFaceIdError({ name: 'WeirdError' })).toMatch(/WeirdError/);
  });
});
