/**
 * Una carta en el tablero o en la mano.
 *
 * Todo lo que se ve aquí es informativo: el coste, el poder y la integridad son
 * números impresos en la carta, no valores que nadie calcule. El servidor jamás
 * los toca.
 */

import type { CardDef, CardInstance } from '../../lib/game/types';
import { FACTIONS } from '../../lib/game/types';

interface CardTileProps {
  def: CardDef;
  /** Instancia en mesa; ausente si la carta está en la mano. */
  instance?: CardInstance;
  width: number;
  selected?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
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
  onDragStart,
  onDragEnd,
  className = '',
}: CardTileProps) {
  const faceDown = instance ? !instance.faceUp : false;
  const tapped = instance?.tapped ?? false;
  const faction = FACTIONS[def.faction];
  const counters = Object.entries(instance?.counters ?? {}).filter(([, v]) => v !== 0);

  return (
    <button
      type="button"
      className={`card text-left ${className}`}
      style={{ width, ['--cut' as string]: `${Math.max(5, width * 0.11)}px` }}
      data-selected={selected}
      data-tapped={tapped}
      data-facedown={faceDown}
      draggable={draggable}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={faceDown ? 'Carta boca abajo' : `${def.name} — ${def.text}`}
      aria-label={faceDown ? 'Carta boca abajo' : def.name}
    >
      {faceDown ? (
        <span className="flex h-full items-center justify-center">
          <span className="hud-sub rotate-90 text-[8px] whitespace-nowrap opacity-50">
            Cosmic Breaker
          </span>
        </span>
      ) : (
        <>
          <span className="card__strip" style={{ background: faction.color }} />

          <span className="flex h-full flex-col gap-0.5 overflow-hidden py-1 pr-1 pl-2">
            <span className="flex items-start justify-between gap-1">
              <span
                className="display line-clamp-3 min-w-0 flex-1 leading-[1.05] tracking-normal break-words"
                style={{ fontSize: nameFontSize(def.name, width) }}
              >
                {def.name}
              </span>
              <span
                className="tabular shrink-0 bg-[rgba(255,255,255,0.1)] px-[3px] leading-tight"
                style={{ fontSize: Math.max(7, width * 0.13) }}
              >
                {def.cost}
              </span>
            </span>

            <span
              className="hud-sub truncate"
              style={{ fontSize: Math.max(6, width * 0.1), letterSpacing: '0.08em' }}
            >
              {faction.name}
            </span>

            <span className="mt-auto flex items-end justify-between gap-1">
              {def.power !== undefined || def.integrity !== undefined ? (
                <span
                  className="tabular font-semibold"
                  style={{ fontSize: Math.max(8, width * 0.15) }}
                >
                  {def.power ?? '—'}
                  <span className="text-[var(--color-ink-faint)]">/</span>
                  {def.integrity ?? '—'}
                </span>
              ) : (
                <span />
              )}
              {def.heat ? (
                <span
                  className="tabular text-[var(--color-heat)]"
                  style={{ fontSize: Math.max(7, width * 0.12) }}
                  title={`Calor sugerido: ${def.heat}`}
                >
                  ▲{def.heat}
                </span>
              ) : null}
            </span>
          </span>
        </>
      )}

      {counters.length > 0 ? (
        <span className="absolute -top-1 -right-1 flex gap-0.5">
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

/**
 * Tamaño de letra del nombre.
 *
 * A 60-80 px de ancho, un nombre como «Acorazado Fragua» no cabe: el navegador
 * lo partiría por la mitad de la palabra («ACORAZ / ADO»), que se lee fatal.
 * En vez de eso se reduce el cuerpo hasta que la palabra MÁS LARGA quepa en una
 * línea, con un mínimo legible. El nombre completo sigue disponible en el
 * tooltip y en el inspector.
 */
function nameFontSize(name: string, width: number): number {
  const available = width - 28; // padding lateral + chip de coste + separación
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length), 1);
  // Oxanium en caja alta ocupa ~0.70em por carácter.
  const fitting = available / (longestWord * 0.7);
  // Por debajo de 7 px no se lee: a partir de ahí es mejor partir la palabra
  // (lo permite break-words) que seguir encogiendo.
  return Math.max(7, Math.min(width * 0.135, fitting));
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

  return (
    <button
      type="button"
      className="relative block"
      style={{ width }}
      onClick={onClick}
      aria-label={`${label}: ${count} cartas`}
      title={`${label}: ${count} cartas`}
    >
      {/* Lomos apilados: dan sensación de volumen sin dibujar cada carta. */}
      {!empty && count > 1 ? (
        <span
          className="absolute inset-0 translate-x-[3px] translate-y-[3px] border border-[var(--color-stroke-faint)] bg-[var(--color-plate)]"
          style={{ aspectRatio: '5 / 7' }}
          aria-hidden="true"
        />
      ) : null}

      {empty ? (
        <span
          className="dropzone flex items-center justify-center"
          style={{ aspectRatio: '5 / 7' }}
        >
          <span className="hud-sub text-[9px]">Vacía</span>
        </span>
      ) : faceDown || !top ? (
        <span
          className="card relative flex items-center justify-center"
          style={{ width: '100%', ['--cut' as string]: `${Math.max(5, width * 0.11)}px` }}
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
