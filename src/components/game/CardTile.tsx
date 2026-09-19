/**
 * Una carta en el tablero o en la mano.
 *
 * El cromo (selección, giro, reverso, contadores) vive aquí.
 * El arte y los datos por tipo los pinta CardFrame, el mismo layout que Card Forger.
 */

import CardFrame from '../card-frame/CardFrame';
import { getCardSize } from '../../lib/card/getCardTypeFields';
import { stripKeywordMarkers } from '../../lib/card/extractKeywords';
import type { CardDef, CardInstance } from '../../lib/game/types';

interface CardTileProps {
  def: CardDef;
  /** Instancia en mesa; ausente si la carta está en la mano. */
  instance?: CardInstance;
  width: number;
  selected?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onDragStart?: (event: React.DragEvent) => void;
  onDragEnd?: (event: React.DragEvent) => void;
  className?: string;
}

export function CardTile({
  def,
  instance,
  width,
  selected = false,
  draggable = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  onPointerEnter,
  onPointerLeave,
  onDragStart,
  onDragEnd,
  className = '',
}: CardTileProps) {
  const faceDown = instance ? !instance.faceUp : false;
  const tapped = instance?.tapped ?? false;
  const { w: nativeW, h: nativeH } = getCardSize(def.tipo);
  const scale = width / nativeW;
  const height = nativeH * scale;
  const counters = Object.entries(instance?.counters ?? {}).filter(([, v]) => v !== 0);
  const tooltip = faceDown
    ? 'Carta boca abajo'
    : `${def.nombre} — ${stripKeywordMarkers(def.texto_efecto ?? '')}`.trim();

  return (
    <button
      type="button"
      className={`game-card text-left ${className}`}
      style={{ width, height }}
      data-selected={selected}
      data-tapped={tapped}
      data-facedown={faceDown}
      draggable={draggable}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(event);
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={tooltip}
      aria-label={faceDown ? 'Carta boca abajo' : def.nombre}
    >
      {faceDown ? (
        <span className="flex h-full items-center justify-center">
          <span className="hud-sub rotate-90 text-[8px] whitespace-nowrap opacity-50">
            Cosmic Breaker
          </span>
        </span>
      ) : (
        <span
          className="pointer-events-none block overflow-hidden"
          style={{ width, height }}
        >
          <span
            className="block origin-top-left"
            style={{
              width: nativeW,
              height: nativeH,
              transform: `scale(${scale})`,
            }}
          >
            <CardFrame card={def} />
          </span>
        </span>
      )}

      {counters.length > 0 ? (
        <span className="absolute -top-1 -right-1 z-10 flex gap-0.5">
          {counters.map(([key, value]) => (
            <span
              key={key}
              className="tabular border border-[var(--color-signal)] bg-[var(--color-void)] px-1 text-[9px] leading-tight text-[var(--color-signal)]"
              title={key}
            >
              {value > 0 ? `+${value}` : value}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

/** Lomo de una pila (mazo, vacío): una carta con el contador encima. */
export function CardStack({
  count,
  width,
  label,
  onClick,
  faceDown = true,
  top,
}: {
  count: number;
  width: number;
  label: string;
  onClick?: () => void;
  faceDown?: boolean;
  top?: CardDef;
}) {
  const empty = count === 0;
  const { w: nativeW, h: nativeH } = getCardSize(top?.tipo ?? 'Nave');
  const height = width * (nativeH / nativeW);

  return (
    <button
      type="button"
      className="relative block"
      style={{ width }}
      onClick={onClick}
      aria-label={`${label}: ${count} cartas`}
      title={`${label}: ${count} cartas`}
    >
      {!empty && count > 1 ? (
        <span
          className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-lg border border-[var(--color-stroke-faint)] bg-[var(--color-plate)]"
          style={{ height }}
          aria-hidden="true"
        />
      ) : null}

      {empty ? (
        <span
          className="dropzone flex items-center justify-center rounded-lg"
          style={{ height }}
        >
          <span className="hud-sub text-[9px]">Vacía</span>
        </span>
      ) : faceDown || !top ? (
        <span
          className="game-card relative flex items-center justify-center"
          style={{ width: '100%', height }}
          data-facedown="true"
        >
          <span className="display tabular text-lg">{count}</span>
        </span>
      ) : (
        <CardTile def={top} width={width} />
      )}

      <span className="hud-sub mt-1 block text-center text-[9px]">
        {count} carta{count === 1 ? '' : 's'}
      </span>
    </button>
  );
}
