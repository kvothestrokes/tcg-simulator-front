/**
 * Zoom flotante de calidad de vida: al pasar el cursor sobre una carta se
 * muestra una versión grande y legible junto al puntero, sin taparlo.
 *
 * Es puramente pasivo (no captura eventos) y se posiciona con listeners de
 * ventana, así no hace falta cambiar la firma de cada CardTile del tablero.
 * Se oculta mientras arrastras para no estorbar al drag & drop nativo.
 */

import { useEffect, useState } from 'react';

import { CardTile } from './CardTile';
import { getCardSize } from '../../lib/card/getCardTypeFields';
import type { CardDef, CardInstance } from '../../lib/game/types';

interface CardHoverZoomProps {
  def: CardDef;
  instance?: CardInstance;
}

const OFFSET = 22;
const MARGIN = 12;
const PORTRAIT_WIDTH = 280;
const STATION_WIDTH = 460;

export function CardHoverZoom({ def, instance }: CardHoverZoomProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const width = def.tipo === 'Estación' ? STATION_WIDTH : PORTRAIT_WIDTH;
  const { w: nativeW, h: nativeH } = getCardSize(def.tipo);
  const height = (nativeH / nativeW) * width;

  useEffect(() => {
    const onMove = (event: MouseEvent) => setPos({ x: event.clientX, y: event.clientY });
    const onDragStart = () => setDragging(true);
    const onDragEnd = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('dragstart', onDragStart);
    window.addEventListener('dragend', onDragEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('dragend', onDragEnd);
    };
  }, []);

  if (!pos || dragging || typeof window === 'undefined') return null;

  // A la derecha del cursor por defecto; si no cabe, al otro lado.
  let left = pos.x + OFFSET;
  if (left + width > window.innerWidth - MARGIN) left = pos.x - OFFSET - width;
  if (left < MARGIN) left = MARGIN;

  let top = pos.y - height / 2;
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN));

  return (
    <div
      className="pointer-events-none fixed z-[60] drop-shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
      style={{ left, top }}
      aria-hidden
    >
      <CardTile def={def} instance={instance} width={width} />
    </div>
  );
}
