/**
 * Nave insignia de los menús. Las llamas son <span> HTML y no nodos SVG: así
 * su animación de transform corre en el compositor sin repintar el SVG.
 */

interface HeroShipProps {
  className?: string;
}

export function HeroShip({ className = '' }: HeroShipProps) {
  return (
    <div className={`hero-ship ${className}`} aria-hidden="true">
      <span className="hero-ship__glow" />
      <span className="hero-ship__flame" style={{ top: '43%' }} />
      <span className="hero-ship__flame" style={{ top: '57%', animationDelay: '-0.11s' }} />
      <svg viewBox="0 0 240 110" fill="none">
        <defs>
          <linearGradient id="hero-hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="0.4" stopColor="#7c8aa5" />
            <stop offset="1" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="hero-wing" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#312e81" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="hero-canopy" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#cffafe" />
            <stop offset="0.5" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#155e75" />
          </linearGradient>
          <linearGradient id="hero-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e879f9" />
            <stop offset="1" stopColor="#67e8f9" />
          </linearGradient>
        </defs>

        <path
          d="M128 40 L104 8 L88 6 L96 38 Z M128 70 L104 102 L88 104 L96 72 Z"
          fill="url(#hero-wing)"
          stroke="url(#hero-edge)"
          strokeWidth="1"
        />
        <path d="M104 8 L88 6 M104 102 L88 104" stroke="#e879f9" strokeWidth="2.5" />

        <path
          d="M236 55 L200 45 L156 39 L124 34 L66 38 L40 44 L30 50 L30 60 L40 66 L66 72 L124 76 L156 71 L200 65 Z"
          fill="url(#hero-hull)"
          stroke="#67e8f9"
          strokeOpacity="0.6"
          strokeWidth="1"
        />
        <path d="M66 55 H176" stroke="#0f172a" strokeOpacity="0.45" strokeWidth="1.2" />
        <path d="M124 34 L132 55 L124 76" stroke="#0f172a" strokeOpacity="0.35" strokeWidth="1" />
        <path d="M60 46 H112 M60 64 H112" stroke="#67e8f9" strokeOpacity="0.4" strokeWidth="0.8" />

        <rect x="22" y="43" width="12" height="8" rx="1.5" fill="#334155" stroke="#94a3b8" strokeWidth="0.6" />
        <rect x="22" y="59" width="12" height="8" rx="1.5" fill="#334155" stroke="#94a3b8" strokeWidth="0.6" />

        <ellipse cx="184" cy="55" rx="20" ry="6.5" fill="url(#hero-canopy)" />
        <path d="M172 52 Q184 49 196 52" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.2" />

        <circle cx="90" cy="9" r="1.8" fill="#fb7185" />
        <circle cx="90" cy="101" r="1.8" fill="#4ade80" />
      </svg>
    </div>
  );
}

/** Emblemas decorativos para las tarjetas de misión del hangar. */
export function MissionEmblem({ kind }: { kind: 'launch' | 'dock' | 'deck' }) {
  return (
    <svg className="menu-tile__emblem" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
      {kind === 'launch' ? (
        <path
          d="M24 8 C30 14 31 22 29 30 L19 30 C17 22 18 14 24 8 Z M19 30 L14 36 L19 34 M29 30 L34 36 L29 34 M22 34 L24 41 L26 34"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ) : kind === 'dock' ? (
        <path
          d="M10 24 H20 M28 24 H38 M20 17 V31 M28 17 V31 M20 24 H28 M14 20 L10 24 L14 28 M34 20 L38 24 L34 28"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M15 14 H29 V36 H15 Z M19 11 H33 V33 M24 21 L26 25 L24 29 L22 25 Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
