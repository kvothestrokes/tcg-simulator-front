import type { CardDef as Card } from '../../lib/game/types'

interface Props {
  card: Card
}

/** Nombre + línea de tipo de la carta. */
export default function CardHeader({ card }: Props) {
  const line = buildTypeLine(card)
  const long = card.nombre.length > 22
  const denseLine = line.join(' · ').length > 34

  return (
    <header className="card-title-block">
      <h2 className={`card-name${long ? ' is-long' : ''}`}>{card.nombre || 'SIN NOMBRE'}</h2>
      <p className={`card-typeline${denseLine ? ' is-dense' : ''}`}>
        {line.map((part, i) => (
          <span key={part + i}>
            {i > 0 && <span className="dot">·</span>}
            {part}
          </span>
        ))}
      </p>
    </header>
  )
}

function buildTypeLine(card: Card): string[] {
  const parts: string[] = [card.tipo.toLocaleUpperCase('es')]
  if (card.tipo === 'Nave' && card.rol) parts.push(card.rol.toLocaleUpperCase('es'))
  if (card.tipo === 'Orden' && card.subtipo) parts.push(card.subtipo.toLocaleUpperCase('es'))
  if (card.tipo === 'Gear' && card.restriccion_equipamiento)
    parts.push(card.restriccion_equipamiento.toLocaleUpperCase('es'))
  parts.push(card.faccion.toLocaleUpperCase('es'))
  return parts
}
