import { describe, expect, it } from 'vitest';

import {
  generateStars,
  seededRandom,
  spiralArmPath,
  spiralDust,
  starfieldSvg,
  starfieldTile,
} from './starfield';

describe('seededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays within [0, 1)', () => {
    const rand = seededRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const n = rand();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('generateStars', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const opts = { count: 20, size: 256, seed: 3 };
    expect(generateStars(opts)).toEqual(generateStars(opts));
    expect(generateStars({ ...opts, seed: 4 })).not.toEqual(generateStars(opts));
  });

  it('keeps every star inside the tile and within the radius range', () => {
    const stars = generateStars({ count: 200, size: 300, seed: 9, minR: 0.5, maxR: 2 });
    expect(stars).toHaveLength(200);
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(300);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(300);
      expect(s.r).toBeGreaterThanOrEqual(0.5);
      expect(s.r).toBeLessThanOrEqual(2);
    }
  });
});

describe('starfieldSvg', () => {
  it('renders one circle per star at the tile size', () => {
    const svg = starfieldSvg(generateStars({ count: 5, size: 128, seed: 1 }), 128);
    expect(svg.match(/<circle /g)).toHaveLength(5);
    expect(svg).toContain('width="128"');
  });

  it('wraps the tile as an encoded CSS url()', () => {
    const tile = starfieldTile({ count: 3, size: 64, seed: 1 });
    expect(tile.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(tile).not.toContain('<');
  });
});

describe('spiral helpers', () => {
  it('builds a path that starts with a move and has one point per step', () => {
    const d = spiralArmPath({ cx: 100, cy: 100, steps: 10 });
    expect(d.startsWith('M')).toBe(true);
    expect(d.split(' L')).toHaveLength(11);
  });

  it('scatters a deterministic amount of dust', () => {
    const opts = { cx: 0, cy: 0, seed: 5, count: 40 };
    expect(spiralDust(opts)).toHaveLength(40);
    expect(spiralDust(opts)).toEqual(spiralDust(opts));
  });
});
