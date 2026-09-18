/* ============================================================
   SIMBOLOGÍA — una forma propia por dato.
   Todo SVG inline, sin dependencias ni fuentes de iconos.
   ============================================================ */

interface IconProps {
  size?: number
  className?: string
  color?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 32 32',
  xmlns: 'http://www.w3.org/2000/svg',
})

/* RECURSOS — círculo */
export function IconRecursos({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill={color} fillOpacity="0.55" />
      <circle cx="16" cy="16" r="11" fill="none" stroke={color} strokeWidth="2.2" />
    </svg>
  )
}

/* HEAT — hexágono */
export function IconHeat({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z"
        fill={color}
        fillOpacity="0.75"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ACORAZADO — hexágono doble */
export function IconAcorazado({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M16 3 L27 9.5 L27 22.5 L16 29 L5 22.5 L5 9.5 Z"
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M16 10 L22 13.5 L22 18.5 L16 22 L10 18.5 L10 13.5 Z"
        fill={color}
        fillOpacity="0.9"
      />
    </svg>
  )
}

/* CAZA — punta de lanza */
export function IconCaza({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M16 2 L26 28 L16 21 L6 28 Z" fill={color} />
    </svg>
  )
}

/* SOPORTE — 3 nodos enlazados */
export function IconSoporte({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M16 7 L7 24 M16 7 L25 24 M7 24 L25 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeOpacity="0.85"
      />
      <circle cx="16" cy="6" r="4" fill="none" stroke={color} strokeWidth="2.4" />
      <circle cx="6.5" cy="25" r="3.6" fill={color} />
      <circle cx="25.5" cy="25" r="3.6" fill={color} />
    </svg>
  )
}

/* CORBETA — dardo compacto con aletas */
export function IconCorbeta({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M16 3 L21 16 L16 14 L11 16 Z" fill={color} />
      <path d="M8 18 L16 14.5 L24 18 L16 28 Z" fill={color} fillOpacity="0.7" />
    </svg>
  )
}

/* FRAGATA — casco largo con quilla */
export function IconFragata({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        fill={color}
        fillRule="evenodd"
        d="M16 2 L24 12 L21 29 L16 25 L11 29 L8 12 Z M15 8 H17 V22 H15 Z"
      />
    </svg>
  )
}

/* DESTRUCTOR — cuña de ataque con batería */
export function IconDestructor({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        fill={color}
        fillRule="evenodd"
        d="M16 2 L28 13 L23 29 L16 24 L9 29 L4 13 Z M9.5 13.2 H22.5 V16 H9.5 Z M11.5 18.2 H20.5 V20.4 H11.5 Z"
      />
    </svg>
  )
}

/* CRUCERO — hexágono alargado con puente */
export function IconCrucero({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        fill={color}
        fillRule="evenodd"
        d="M9 4 H23 L29 16 L23 28 H9 L3 16 Z M14 7 H18 V16 H14 Z"
      />
    </svg>
  )
}

/* TITÁN — fortaleza estelar */
export function IconTitan({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M11 3 H21 L29 11 V21 L21 29 H11 L3 21 V11 Z"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        fill={color}
        fillRule="evenodd"
        d="M16 7 L25 16 L16 25 L7 16 Z M16 12.6 A3.4 3.4 0 1 0 16 19.4 A3.4 3.4 0 1 0 16 12.6 Z"
      />
    </svg>
  )
}

/* GEAR (slot) — rombo */
export function IconGear({ size = 24, className, color = 'currentColor', filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M16 3 L29 16 L16 29 L3 16 Z"
        fill={filled ? color : 'none'}
        fillOpacity={filled ? 0.85 : 0}
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ATAQUE — punta de flecha */
export function IconAtaque({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M6 3 L28 16 L6 29 Z" fill={color} />
    </svg>
  )
}

/* ESCUDO — broquel */
export function IconEscudo({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M4 3 H28 V16 L16 29 L4 16 Z" fill={color} />
    </svg>
  )
}

/* CHATARRA — anillo dentado */
export function IconChatarra({ size = 24, className, color = 'currentColor' }: IconProps) {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 8
    const x = 16 + Math.cos(angle) * 13
    const y = 16 + Math.sin(angle) * 13
    return (
      <rect
        key={i}
        x={x - 2.6}
        y={y - 2.6}
        width="5.2"
        height="5.2"
        rx="1"
        fill={color}
        transform={`rotate(${(angle * 180) / Math.PI} ${x} ${y})`}
      />
    )
  })
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      {teeth}
      <circle cx="16" cy="16" r="9.5" fill={color} />
      <circle cx="16" cy="16" r="4" fill="#07090f" />
    </svg>
  )
}

/* HP ESTACIÓN — cruz técnica */
export function IconHP({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 3 H20 V12 H29 V20 H20 V29 H12 V20 H3 V12 H12 Z" fill={color} />
    </svg>
  )
}

/* ORDEN — pulso de mando */
export function IconOrden({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M18 2 L7 17 H15 L13 30 L25 14 H17 Z" fill={color} />
    </svg>
  )
}

/* PILOTO — casco con visor */
export function IconPiloto({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path
        d="M16 3 C23 3 28 8 28 15 V24 H21 L18 28 H14 L11 24 H4 V15 C4 8 9 3 16 3 Z"
        fill="none"
        stroke={color}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      <path d="M8.5 13 H23.5 V19 H8.5 Z" fill={color} fillOpacity="0.9" />
    </svg>
  )
}

/* ENLACE — anclaje de piloto */
export function IconEnlace({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="10" cy="16" r="5.5" fill="none" stroke={color} strokeWidth="2.4" />
      <circle cx="22" cy="16" r="5.5" fill="none" stroke={color} strokeWidth="2.4" />
      <path d="M14 16 H18" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}

/* MOMENTO DE JUEGO — reloj de fase */
export function IconMomento({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="2.3" />
      <path d="M16 8 V16 L22 19" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

/* ESTACIÓN — anillo orbital */
export function IconEstacion({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <ellipse cx="16" cy="16" rx="13" ry="5.5" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="16" cy="16" r="4.2" fill={color} />
      <path d="M8 14 L8 10 H12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M24 18 L24 22 H20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* BASE — plataforma */
export function IconBase({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M6 22 H26 L22 26 H10 Z" fill={color} />
      <path d="M11 22 V12 H21 V22" fill="none" stroke={color} strokeWidth="2.2" />
      <rect x="14" y="6" width="4" height="7" fill={color} />
    </svg>
  )
}

/* ASTILLERO — dársena */
export function IconAstillero({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M5 26 H27" stroke={color} strokeWidth="2.4" />
      <path d="M8 26 V14 H12 V26 M20 26 V10 H24 V26" fill="none" stroke={color} strokeWidth="2.2" />
      <path d="M12 16 H20" stroke={color} strokeWidth="2" />
    </svg>
  )
}

/* PUERTO — muelle anular */
export function IconPuerto({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="none" stroke={color} strokeWidth="2.2" />
      <circle cx="16" cy="16" r="4" fill={color} />
      <path d="M16 5 V12 M27 16 H20 M16 27 V20 M5 16 H12" stroke={color} strokeWidth="2" />
    </svg>
  )
}

/* RELÉ — baliza */
export function IconRele({ size = 24, className, color = 'currentColor' }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M16 28 V14" stroke={color} strokeWidth="2.4" />
      <circle cx="16" cy="10" r="4" fill={color} />
      <path
        d="M8 12 C8 6 24 6 24 12"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 16 C5 6 27 6 27 16"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}

/* Selector de icono por rol de nave o estación */
export function RoleIcon({ rol, size = 24, color }: { rol?: string; size?: number; color?: string }) {
  switch (rol) {
    case 'Caza':
      return <IconCaza size={size} color={color} />
    case 'Corbeta':
      return <IconCorbeta size={size} color={color} />
    case 'Fragata':
      return <IconFragata size={size} color={color} />
    case 'Destructor':
      return <IconDestructor size={size} color={color} />
    case 'Crucero':
      return <IconCrucero size={size} color={color} />
    case 'Titán':
      return <IconTitan size={size} color={color} />
    case 'Soporte':
      return <IconSoporte size={size} color={color} />
    case 'Base':
      return <IconBase size={size} color={color} />
    case 'Astillero':
      return <IconAstillero size={size} color={color} />
    case 'Puerto':
      return <IconPuerto size={size} color={color} />
    case 'Relé':
      return <IconRele size={size} color={color} />
    case 'Acorazado':
    default:
      return <IconAcorazado size={size} color={color} />
  }
}

/* Selector de icono por tipo de carta */
export function CardTypeIcon({ tipo, size = 24, color }: { tipo: string; size?: number; color?: string }) {
  switch (tipo) {
    case 'Orden':
      return <IconOrden size={size} color={color} />
    case 'Piloto':
      return <IconPiloto size={size} color={color} />
    case 'Gear':
      return <IconGear size={size} color={color} />
    case 'Estación':
      return <IconEstacion size={size} color={color} />
    default:
      return <IconAcorazado size={size} color={color} />
  }
}
