import type { FactionTheme } from '../../lib/game/types'

interface Props {
  artwork?: string
  theme: FactionTheme
  nombre: string
  framed?: boolean
}

/**
 * Zona de arte. Sin imagen cargada dibuja un fondo procedural
 * (SVG inline) coherente con la facción, nunca un placeholder vacío.
 */
export default function CardArtwork({ artwork, theme, nombre, framed }: Props) {
  const cls = `card-art${framed ? ' is-framed' : ''}`

  if (artwork) {
    return (
      <div className={cls}>
        <img className="card-art-img" src={artwork} alt={nombre} />
        <div className="card-art-vignette" />
        <div className="card-art-hud" />
      </div>
    )
  }

  return (
    <div className={cls}>
      <ProceduralArt theme={theme} />
      <div className="card-art-vignette" />
      <div className="card-art-hud" />
    </div>
  )
}

const STAR_POINTS = [
  { cx: 42, cy: 38, r: 1.4, opacity: 0.55 },
  { cx: 88, cy: 72, r: 2.1, opacity: 0.7 },
  { cx: 130, cy: 28, r: 1.2, opacity: 0.4 },
  { cx: 176, cy: 96, r: 1.8, opacity: 0.62 },
  { cx: 248, cy: 44, r: 2.4, opacity: 0.75 },
  { cx: 292, cy: 88, r: 1.3, opacity: 0.45 },
  { cx: 338, cy: 36, r: 1.9, opacity: 0.68 },
  { cx: 378, cy: 110, r: 1.5, opacity: 0.5 },
  { cx: 58, cy: 148, r: 1.6, opacity: 0.48 },
  { cx: 104, cy: 196, r: 2.2, opacity: 0.72 },
  { cx: 154, cy: 232, r: 1.1, opacity: 0.38 },
  { cx: 268, cy: 210, r: 1.7, opacity: 0.58 },
  { cx: 312, cy: 168, r: 2.0, opacity: 0.66 },
  { cx: 366, cy: 226, r: 1.4, opacity: 0.52 },
  { cx: 48, cy: 268, r: 1.8, opacity: 0.6 },
  { cx: 210, cy: 286, r: 1.3, opacity: 0.42 },
  { cx: 390, cy: 278, r: 2.1, opacity: 0.7 },
] as const

function ProceduralArt({ theme }: { theme: FactionTheme }) {
  const { pattern, primary, accent, artFrom, artTo } = theme

  return (
    <svg
      className="card-art-proc"
      viewBox="0 0 420 330"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="proc-bg" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={artFrom} />
          <stop offset="100%" stopColor={artTo} />
        </linearGradient>
        <radialGradient id="proc-core" cx="50%" cy="48%" r="46%">
          <stop offset="0%" stopColor={primary} stopOpacity="0.85" />
          <stop offset="55%" stopColor={primary} stopOpacity="0.18" />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="420" height="330" fill="url(#proc-bg)" />
      <circle cx="210" cy="158" r="150" fill="url(#proc-core)" />

      {pattern === 'grid' && (
        <g stroke={primary} strokeOpacity="0.22" strokeWidth="1">
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`v${i}`} x1={i * 42} y1="0" x2={i * 42} y2="330" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 42} x2="420" y2={i * 42} />
          ))}
          <path d="M60 300 L210 60 L360 300 Z" fill="none" stroke={accent} strokeOpacity="0.4" strokeWidth="2" />
        </g>
      )}

      {pattern === 'scan' && (
        <g>
          {Array.from({ length: 16 }, (_, i) => (
            <rect
              key={i}
              x="0"
              y={i * 22}
              width="420"
              height="6"
              fill={primary}
              opacity={i % 3 === 0 ? 0.16 : 0.07}
            />
          ))}
          <path d="M40 250 L140 90 L250 150 L380 70 L380 290 L40 290 Z" fill={accent} opacity="0.13" />
        </g>
      )}

      {pattern === 'organic' && (
        <g fill="none" stroke={primary} strokeOpacity="0.3" strokeWidth="1.6">
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx="210" cy="165" rx={40 + i * 26} ry={26 + i * 19} transform={`rotate(${i * 12} 210 165)`} />
          ))}
          <circle cx="210" cy="165" r="26" fill={accent} fillOpacity="0.35" stroke="none" />
        </g>
      )}

      {pattern === 'neon' && (
        <g>
          <g stroke={primary} strokeOpacity="0.3" strokeWidth="1.2">
            {Array.from({ length: 10 }, (_, i) => (
              <path key={i} d={`M0 ${20 + i * 32} H${120 + ((i * 47) % 200)} L${160 + ((i * 37) % 180)} ${52 + i * 32} H420`} fill="none" />
            ))}
          </g>
          <g fill={accent} fillOpacity="0.55">
            {Array.from({ length: 12 }, (_, i) => (
              <circle key={i} cx={((i * 71) % 400) + 10} cy={((i * 53) % 300) + 15} r="2.6" />
            ))}
          </g>
          <path d="M150 300 L210 70 L270 300 Z" fill={primary} fillOpacity="0.1" />
        </g>
      )}

      {pattern === 'geometric' && (
        <g stroke={primary} strokeOpacity="0.35" strokeWidth="1.4" fill="none">
          {Array.from({ length: 6 }, (_, i) => {
            const r = 30 + i * 24
            const pts = Array.from({ length: 6 }, (_, k) => {
              const a = (Math.PI / 3) * k - Math.PI / 2
              return `${210 + Math.cos(a) * r},${165 + Math.sin(a) * r}`
            }).join(' ')
            return <polygon key={i} points={pts} />
          })}
          <line x1="0" y1="165" x2="420" y2="165" stroke={accent} strokeOpacity="0.4" />
        </g>
      )}

      {pattern === 'gears' && (
        <g stroke={primary} strokeOpacity="0.35" fill="none" strokeWidth="2">
          <circle cx="130" cy="200" r="70" />
          <circle cx="130" cy="200" r="46" strokeDasharray="8 10" />
          <circle cx="300" cy="120" r="52" />
          <circle cx="300" cy="120" r="30" strokeDasharray="6 9" />
          <path d="M0 290 H420" stroke={accent} strokeOpacity="0.4" strokeWidth="3" />
          <path d="M60 290 V240 M180 290 V255 M330 290 V230" stroke={accent} strokeOpacity="0.3" />
        </g>
      )}

      {pattern === 'stars' && (
        <g>
          <g fill={primary}>
            {STAR_POINTS.map((star) => (
              <circle
                key={`${star.cx}-${star.cy}`}
                cx={star.cx}
                cy={star.cy}
                r={star.r}
                opacity={star.opacity}
              />
            ))}
          </g>
          <circle cx="210" cy="165" r="88" fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="1.2" />
          <circle cx="210" cy="165" r="118" fill="none" stroke={primary} strokeOpacity="0.12" strokeWidth="1" />
        </g>
      )}

      <g opacity="0.5">
        <rect x="36" y="46" width="348" height="2" fill={primary} opacity="0.55" />
        <rect x="56" y="282" width="308" height="2" fill={primary} opacity="0.4" />
      </g>
    </svg>
  )
}
