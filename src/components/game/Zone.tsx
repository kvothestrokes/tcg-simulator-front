/**
 * Zona del tablero: el rectángulo punteado del wireframe, que además es destino
 * de arrastre.
 *
 * Las zonas son de «tamaño libre»: no tienen huecos fijos, las cartas se
 * colocan en flujo y la zona hace scroll si se llena. La excepción es el Área
 * de Pilotos, que sí tiene tres huecos (ver PilotSlots).
 */

import type { ReactNode } from 'react';
import { useState } from 'react';

import { readDragPayload, type DragPayload } from './dnd';
import type { ZoneId } from '../../lib/game/types';

interface ZoneProps {
  zone: ZoneId;
  children: ReactNode;
  /** Solo se puede soltar en tus propias zonas. */
  droppable?: boolean;
  onDropCard?: (payload: DragPayload, zone: ZoneId) => void;
  /** Resalta la zona como destino válido de la carta seleccionada. */
  highlighted?: boolean;
  onClick?: () => void;
  className?: string;
  emptyHint?: string;
  /**
   * Clases de overflow de la zona. Por defecto solo scroll vertical, pero las
   * zonas cuyas cartas ya se dimensionan para caber lo apagan para no recortar.
   */
  overflow?: string;
}

export function Zone({
  zone,
  children,
  droppable = false,
  onDropCard,
  highlighted = false,
  onClick,
  className = '',
  emptyHint,
  overflow = 'overflow-y-auto',
}: ZoneProps) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`dropzone relative min-h-0 ${overflow} ${className}`}
      data-over={droppable && over}
      data-target={highlighted}
      onClick={onClick}
      onDragOver={(event) => {
        if (!droppable) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={(event) => {
        // Solo cuenta salir de la zona, no pasar de un hijo a otro.
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={(event) => {
        if (!droppable) return;
        event.preventDefault();
        setOver(false);
        const payload = readDragPayload(event);
        if (payload) onDropCard?.(payload, zone);
      }}
    >
      {children}
      {emptyHint ? (
        <span className="hud-sub pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] opacity-45">
          {emptyHint}
        </span>
      ) : null}
    </div>
  );
}
