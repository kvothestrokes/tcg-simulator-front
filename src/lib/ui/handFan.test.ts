import { describe, expect, it } from 'vitest';

import { FOCUS_SCALE, MAX_FAN_ANGLE, REST_HIDE_RATIO, fanLayout } from './handFan';

const BASE = {
  cardWidth: 100,
  cardHeight: 140,
  maxWidth: 800,
};

function widthOf(slots: ReturnType<typeof fanLayout>, cardWidth: number): number {
  let minL = Infinity;
  let maxR = -Infinity;
  for (const slot of slots) {
    const half = (cardWidth * slot.scale) / 2;
    minL = Math.min(minL, slot.x - half);
    maxR = Math.max(maxR, slot.x + half);
  }
  return maxR - minL;
}

describe('fanLayout', () => {
  it('con 1 carta no hay rotación', () => {
    const [slot] = fanLayout({ ...BASE, count: 1, hoveredIndex: null, expanded: true });
    expect(slot?.rotate).toBe(0);
    expect(slot?.x).toBe(0);
  });

  it('el abanico es simétrico sin carta enfocada', () => {
    const slots = fanLayout({ ...BASE, count: 7, hoveredIndex: null, expanded: true });
    const last = slots.length - 1;
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i]!;
      const b = slots[last - i]!;
      expect(a.rotate).toBeCloseTo(-b.rotate, 8);
      expect(a.x).toBeCloseTo(-b.x, 8);
      expect(a.y).toBeCloseTo(b.y, 8);
      expect(a.scale).toBeCloseTo(b.scale, 8);
    }
    expect(Math.max(...slots.map((s) => Math.abs(s.rotate)))).toBeLessThanOrEqual(MAX_FAN_ANGLE);
  });

  it('la carta enfocada tiene rotación 0 y el mayor z', () => {
    const hoveredIndex = 2;
    const slots = fanLayout({
      ...BASE,
      count: 5,
      hoveredIndex,
      expanded: true,
    });
    const focused = slots[hoveredIndex]!;
    expect(focused.rotate).toBe(0);
    expect(focused.scale).toBeCloseTo(FOCUS_SCALE, 8);
    expect(focused.z).toBeGreaterThan(Math.max(...slots.filter((_, i) => i !== hoveredIndex).map((s) => s.z)));
  });

  it('en reposo y incluye el 60% de ocultación', () => {
    const slots = fanLayout({ ...BASE, count: 6, hoveredIndex: null, expanded: false });
    const hide = BASE.cardHeight * REST_HIDE_RATIO;
    for (const slot of slots) {
      expect(slot.y).toBeGreaterThanOrEqual(hide - 1e-9);
    }
  });

  it('el ancho total nunca supera maxWidth', () => {
    const cases = [
      { count: 1, hoveredIndex: null, expanded: false, maxWidth: 80 },
      { count: 1, hoveredIndex: 0, expanded: true, maxWidth: 120 },
      { count: 12, hoveredIndex: null, expanded: true, maxWidth: 420 },
      { count: 10, hoveredIndex: 4, expanded: true, maxWidth: 500 },
    ];
    for (const sample of cases) {
      const slots = fanLayout({ ...BASE, ...sample });
      expect(widthOf(slots, BASE.cardWidth)).toBeLessThanOrEqual(sample.maxWidth + 1e-6);
    }
  });

  it('sin cartas no hay slots', () => {
    expect(fanLayout({ ...BASE, count: 0, hoveredIndex: null, expanded: true })).toEqual([]);
  });
});
