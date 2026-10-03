/**
 * Generadores deterministas para el fondo cósmico.
 *
 * Se ejecutan en el frontmatter de Astro (en build), así que el navegador
 * recibe SVG estático: cero JS en runtime y el mismo cielo en cada carga.
 */

export interface Star {
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
}

export interface StarfieldOptions {
  count: number;
  /** Lado del tile cuadrado en px; el SVG se repite con background-repeat. */
  size: number;
  seed: number;
  minR?: number;
  maxR?: number;
  palette?: readonly string[];
}

const DEFAULT_PALETTE = ['#ffffff', '#ffffff', '#ffffff', '#bae6fd', '#e9d5ff', '#a5f3fc', '#f5d0fe'];

/** PRNG mulberry32: rápido, sin dependencias y reproducible por semilla. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function generateStars({
  count,
  size,
  seed,
  minR = 0.4,
  maxR = 1.2,
  palette = DEFAULT_PALETTE,
}: StarfieldOptions): Star[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: round(rand() * size),
    y: round(rand() * size),
    // Sesgo hacia estrellas pequeñas: el cielo real tiene muchas más tenues.
    r: round(minR + (maxR - minR) * rand() ** 2.2),
    color: palette[Math.floor(rand() * palette.length)] ?? '#ffffff',
    opacity: round(0.35 + rand() * 0.65),
  }));
}

export function starfieldSvg(stars: readonly Star[], size: number): string {
  const circles = stars
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.color}" opacity="${s.opacity}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}</svg>`;
}

export function svgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Tile de estrellas listo para usar como background-image. */
export function starfieldTile(options: StarfieldOptions): string {
  return svgDataUri(starfieldSvg(generateStars(options), options.size));
}

/**
 * Brazo de espiral logarítmica (r = a·e^(bθ)) como atributo `d` de un path,
 * centrado en (cx, cy). `phase` gira el brazo completo en radianes.
 */
export function spiralArmPath({
  cx,
  cy,
  a = 6,
  b = 0.22,
  turns = 2.2,
  phase = 0,
  steps = 90,
}: {
  cx: number;
  cy: number;
  a?: number;
  b?: number;
  turns?: number;
  phase?: number;
  steps?: number;
}): string {
  const maxTheta = turns * Math.PI * 2;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * maxTheta;
    const r = a * Math.exp(b * theta);
    const x = cx + r * Math.cos(theta + phase);
    const y = cy + r * Math.sin(theta + phase);
    points.push(`${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`);
  }
  return points.join(' ');
}

/** Puntos dispersos a lo largo de una espiral: polvo estelar de los brazos. */
export function spiralDust({
  cx,
  cy,
  seed,
  count,
  arms = 2,
  a = 6,
  b = 0.22,
  turns = 2.2,
  spread = 18,
}: {
  cx: number;
  cy: number;
  seed: number;
  count: number;
  arms?: number;
  a?: number;
  b?: number;
  turns?: number;
  spread?: number;
}): Star[] {
  const rand = seededRandom(seed);
  const maxTheta = turns * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const phase = ((i % arms) / arms) * Math.PI * 2;
    const theta = rand() * maxTheta;
    const r = a * Math.exp(b * theta);
    // La dispersión crece hacia fuera, como en una galaxia real.
    const jitter = spread * (0.3 + r / 260);
    return {
      x: round(cx + r * Math.cos(theta + phase) + (rand() - 0.5) * jitter),
      y: round(cy + r * Math.sin(theta + phase) + (rand() - 0.5) * jitter),
      r: round(0.5 + rand() * 1.3),
      color: DEFAULT_PALETTE[Math.floor(rand() * DEFAULT_PALETTE.length)] ?? '#ffffff',
      opacity: round(0.3 + rand() * 0.7),
    };
  });
}
