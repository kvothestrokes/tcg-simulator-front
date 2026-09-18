import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import type { CardDef as Card } from '../../lib/game/types'
import { getFactionTheme, factionCssVars } from '../../lib/card/getFactionTheme'
import { cardTypeClass } from '../../lib/card/getCardTypeFields'
import { CardTypeIcon, IconGear, RoleIcon } from './icons/Symbology'
import CardArtwork from './CardArtwork'
import CardCost from './CardCost'
import CardEffect from './CardEffect'
import CardFaction from './CardFaction'
import CardHeader from './CardHeader'
import CardStats from './CardStats'
import StationLayout from './StationLayout'

interface Props {
  card: Card
}

/**
 * La carta en sí, a tamaño intrínseco fijo para que la
 * exportación PNG sea siempre nítida e independiente del zoom.
 */
const CardFrame = forwardRef<HTMLDivElement, Props>(function CardFrame({ card }, ref) {
  const theme = getFactionTheme(card.faccion)
  const station = card.tipo === 'Estación'

  return (
    <div
      ref={ref}
      className={`cf-root card faction-${theme.short.toLowerCase()} type-${cardTypeClass(card.tipo)}`}
      style={factionCssVars(card.faccion) as CSSProperties}
    >
      {station ? (
        <StationLayout card={card} />
      ) : (
        <div className="card-inner">
          <CardArtwork artwork={card.artwork_url} theme={theme} nombre={card.nombre} />

          <CardCost recursos={card.coste_recursos} heat={card.coste_heat} />

          <div className="corner-glyph corner-left" title={card.rol ?? card.tipo}>
            {card.tipo === 'Nave' ? (
              <RoleIcon rol={card.rol} size={26} color="var(--f-ink)" />
            ) : (
              <CardTypeIcon tipo={card.tipo} size={26} color="var(--f-ink)" />
            )}
          </div>

          <div className="corner-glyph corner-right" title="Gear">
            <IconGear size={24} color="var(--f-primary)" filled={false} />
          </div>

          <div className="card-body">
            <CardHeader card={card} />

            <CardEffect
              texto={card.texto_efecto}
              fitKey={`${card.tipo}|${card.bono_al_enlazar ?? ''}|${card.bono_sin_enlazar ?? ''}|${card.nombre}`}
            >
              {card.tipo === 'Piloto' && (
                <div className="link-blocks">
                  {card.bono_al_enlazar && (
                    <p className="link-block">
                      <span className="link-tag on">ENLAZADO</span>
                      {card.bono_al_enlazar}
                    </p>
                  )}
                  {card.bono_sin_enlazar && (
                    <p className="link-block">
                      <span className="link-tag off">SIN ENLAZAR</span>
                      {card.bono_sin_enlazar}
                    </p>
                  )}
                </div>
              )}
            </CardEffect>

            <CardStats card={card} />
            <CardFaction
              autor={card.autor}
              rareza={card.rareza}
              numero={card.numero_coleccion}
            />
          </div>
        </div>
      )}

      <span className="frame-corner tl" />
      <span className="frame-corner tr" />
      <span className="frame-corner bl" />
      <span className="frame-corner br" />
    </div>
  )
})

export default CardFrame
