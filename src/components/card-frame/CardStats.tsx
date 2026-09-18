import type { CardDef as Card } from '../../lib/game/types'
import { formatGearModifiers } from '../../lib/card/getCardTypeFields'
import { IconAtaque, IconChatarra, IconEscudo, IconGear, IconMomento, IconEnlace } from './icons/Symbology'
import GearSlots from './GearSlots'

interface Props {
  card: Card
}

function combatValueClass(value: number): string {
  const digits = String(Math.abs(Math.trunc(value))).length
  if (digits >= 6) return 'is-huge'
  if (digits >= 5) return 'is-wide'
  if (digits >= 4) return 'is-long'
  return ''
}

function CombatValue({ value }: { value: number }) {
  const sizeClass = combatValueClass(value)
  return <b className={sizeClass || undefined}>{value}</b>
}

/** Zona inferior de datos. Su composición cambia según el tipo de carta. */
export default function CardStats({ card }: Props) {
  if (card.tipo === 'Nave') {
    return (
      <div className="card-stats-zone">
        <div className="stats-utility">
          <GearSlots total={card.espacios_gear ?? 0} />
          {(card.chatarra_al_morir ?? 0) > 0 && (
            <span className="scrap-pill" title="Chatarra al morir">
              <IconChatarra size={14} color="#9ad83a" />
              SCRAP +{card.chatarra_al_morir}
            </span>
          )}
        </div>

        <div className="stats-combat">
          <span className="stat stat-atk">
            <IconAtaque size={26} color="#ef6a5e" />
            <CombatValue value={card.ataque ?? 0} />
          </span>
          <span className="stat-divider" />
          <span className="stat stat-def">
            <CombatValue value={card.escudo ?? 0} />
            <IconEscudo size={26} color="#3b86e8" />
          </span>
        </div>
      </div>
    )
  }

  if (card.tipo === 'Orden') {
    return (
      <div className="card-stats-zone">
        <div className="stats-tags">
          <span className="data-tag">
            <IconMomento size={14} color="var(--f-primary)" />
            {(card.momento_juego || 'Tu turno').toLocaleUpperCase('es')}
          </span>
          <span className="data-tag ghost">{(card.subtipo || 'Instantánea').toLocaleUpperCase('es')}</span>
        </div>
      </div>
    )
  }

  if (card.tipo === 'Piloto') {
    return (
      <div className="card-stats-zone">
        <div className="stats-tags">
          <span className="data-tag">
            <IconEnlace size={14} color="var(--f-primary)" />
            {(card.requisito_enlace || 'Sin requisito').toLocaleUpperCase('es')}
          </span>
        </div>
      </div>
    )
  }

  const mods = formatGearModifiers(card)

  /* Gear */
  return (
    <div className="card-stats-zone">
      <div className="stats-utility">
        <GearSlots total={card.espacios_ocupa ?? 0} label="OCUPA" />
        {mods ? (
          <span className="mod-pill" title="Modificadores">
            <IconGear size={13} color="var(--f-accent)" />
            {mods}
          </span>
        ) : null}
      </div>
    </div>
  )
}
