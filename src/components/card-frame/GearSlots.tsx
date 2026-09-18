import { IconGear } from './icons/Symbology'

interface Props {
  total: number
  label?: string
  /** slots ocupados: se dibujan rellenos, el resto en contorno */
  filled?: number
  max?: number
}

/**
 * Genera dinámicamente los rombos de Gear.
 * Si `total` es 0 el componente no renderiza nada (la sección se oculta).
 */
export default function GearSlots({ total, label = 'GEAR', filled, max = 8 }: Props) {
  const count = Math.max(0, Math.min(Math.floor(total || 0), max))
  if (count === 0) return null
  const solid = filled === undefined ? count : Math.min(filled, count)

  return (
    <div className="gear-slots">
      <span className="gear-label">{label}</span>
      <span className="gear-row">
        {Array.from({ length: count }, (_, i) => (
          <span className="gear-slot" key={i} style={{ animationDelay: `${i * 45}ms` }}>
            <IconGear size={17} color="var(--f-primary)" filled={i < solid} />
          </span>
        ))}
      </span>
    </div>
  )
}
