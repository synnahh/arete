import { describe, it, expect } from 'vitest';
import { squareCrop } from './avatar.js';

describe('squareCrop', () => {
  it('centres a landscape photo', () => expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 }));
  it('centres a portrait photo', () => expect(squareCrop(300, 900)).toEqual({ sx: 0, sy: 300, side: 300 }));
  it('leaves a square alone', () => expect(squareCrop(100, 100)).toEqual({ sx: 0, sy: 0, side: 100 }));
});
