import type { CardDef as Card } from '../../lib/game/types'
import { getFactionTheme } from '../../lib/card/getFactionTheme'
import { IconHP } from './icons/Symbology'
import { renderEffectText } from '../../lib/card/renderEffectText'
import CardArtwork from './CardArtwork'

interface Props {
  card: Card
}

const HP_COLOR = '#3ee0a0'

/** Layout apaisado de carta Estación: arte a sangre completa con HP y efecto superpuestos. */
export default function StationLayout({ card }: Props) {
  const theme = getFactionTheme(card.faccion)
  const hp = card.hp ?? 0
  const hpMax = Math.max(card.hp_max ?? 0, 0)
  const longName = card.nombre.length > 22

  return (
    <div className="station-inner">
      <div className="station-art-wrap">
        <CardArtwork artwork={card.artwork_url} theme={theme} nombre={card.nombre} />
        {!card.artwork_url && <span className="station-art-caption">Estación · Arte IA</span>}
      </div>

      <header className="station-header">
        <p className="station-kicker">Estación espacial</p>
        <h2 className={`station-name${longName ? ' is-long' : ''}`}>{card.nombre || 'SIN NOMBRE'}</h2>
        <p className="station-typeline">
          {card.faccion.toLocaleUpperCase('es')}
          <span className="dot">·</span>
          {(card.rol || 'Base').toLocaleUpperCase('es')}
        </p>
      </header>

      <div className="station-hp">
        <IconHP size={42} color={HP_COLOR} />
        <div className="station-hp-copy">
          <p className="station-hp-value">
            {hp}
            <span>
              {' '}
              / {hpMax} HP
            </span>
          </p>
          <HpPips current={hp} max={hpMax} />
        </div>
      </div>

      <div className="station-footer">
        <div className="station-effect">
          {card.texto_efecto ? <p>{renderEffectText(card.texto_efecto)}</p> : null}
        </div>
        <p className="station-meta">
          {card.numero_coleccion.toLocaleUpperCase('es')}
          <span className="dot">·</span>
          {card.rareza.toLocaleUpperCase('es')}
        </p>
      </div>
    </div>
  )
}

function HpPips({ current, max }: { current: number; max: number }) {
  const total = Math.min(Math.max(max, 0), 40)
  if (!total) return null

  return (
    <div className="station-hp-pips" style={{ gridTemplateColumns: `repeat(${Math.min(total, 10)}, 1fr)` }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`hp-pip${i < current ? ' is-on' : ''}`} />
      ))}
    </div>
  )
}
