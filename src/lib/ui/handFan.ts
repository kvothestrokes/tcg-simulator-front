/**
 * Layout puro del abanico de la mano.
 *
 * Sin React ni I/O: el componente solo aplica los slots a transform/z-index.
 */

export interface FanSlot {
  /** Desplazamiento horizontal del centro de la carta respecto al centro del abanico. */
  x: number;
  /** Desplazamiento vertical (positivo = hacia abajo). */
  y: number;
  rotate: number;
  scale: number;
  z: number;
}

export const REST_HIDE_RATIO = 0.6;
export const FOCUS_SCALE = 1.6;
export const MAX_FAN_ANGLE = 18;

export interface FanLayoutOpts {
  count: number;
  cardWidth: number;
  cardHeight: number;
  maxWidth: number;
  hoveredIndex: number | null;
  expanded: boolean;
}

export function fanLayout(opts: FanLayoutOpts): FanSlot[] {
  const { count, cardWidth, cardHeight, maxWidth, hoveredIndex, expanded } = opts;
  if (count <= 0) return [];

  const hideY = expanded ? 0 : cardHeight * REST_HIDE_RATIO;
  const focus =
    expanded && hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < count
      ? hoveredIndex
      : null;

  const scaleCap = cardWidth > 0 ? Math.max(1, maxWidth / cardWidth) : 1;
  const focusScale = Math.min(FOCUS_SCALE, scaleCap);

  const mid = (count - 1) / 2;
  const angleSpan = count <= 1 ? 0 : MAX_FAN_ANGLE * Math.min(1, (count - 1) / 5);

  const gapBudget = Math.max(0, maxWidth - cardWidth);
  const maxStep = count <= 1 ? 0 : gapBudget / (count - 1);
  const idealStep = cardWidth * 0.46;
  const step = count <= 1 ? 0 : Math.min(idealStep, maxStep);

  const lift = cardHeight * 0.32;
  const arcDepth = cardHeight * 0.07;
  const spread = cardWidth * 0.28;

  const slots: FanSlot[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i - mid;
    const norm = mid === 0 ? 0 : t / mid;
    let x = t * step;
    let rotate = norm * angleSpan;
    let scale = 1;
    let y = norm * norm * arcDepth + hideY;
    let z = 10 + Math.round((mid - Math.abs(t)) * 2);

    if (focus !== null) {
      const dist = i - focus;
      const ad = Math.abs(dist);
      if (dist !== 0) {
        x += Math.sign(dist) * (spread / ad);
      }
      if (i === focus) {
        rotate = 0;
        scale = focusScale;
        y = hideY - lift;
        z = 1000;
      } else {
        z = 200 - ad;
        y = hideY + norm * norm * arcDepth - lift * 0.12 * Math.max(0, 3 - ad);
      }
    }

    slots.push({ x, y, rotate, scale, z });
  }

  clampFanWidth(slots, cardWidth, maxWidth);
  return slots;
}

function clampFanWidth(slots: FanSlot[], cardWidth: number, maxWidth: number): void {
  if (slots.length === 0 || maxWidth <= 0) return;
  let minL = Infinity;
  let maxR = -Infinity;
  for (const slot of slots) {
    const half = (cardWidth * slot.scale) / 2;
    minL = Math.min(minL, slot.x - half);
    maxR = Math.max(maxR, slot.x + half);
  }
  const width = maxR - minL;
  if (width <= maxWidth || width <= 0) return;
  const k = maxWidth / width;
  for (const slot of slots) {
    slot.x *= k;
    slot.scale *= k;
  }
}

export function fanPeekHeight(cardHeight: number): number {
  return cardHeight * (1 - REST_HIDE_RATIO);
}
