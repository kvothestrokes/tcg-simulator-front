/**
 * Arrastrar y soltar cartas.
 *
 * Se usa la API nativa del navegador: basta para ratón y trackpad, y no añade
 * dependencias. En táctil no hay arrastre nativo, por eso TODA acción posible
 * arrastrando está también disponible pulsando la carta y eligiendo destino en
 * el inspector.
 */

import type { ZoneId } from '../../lib/game/types';

export const DRAG_MIME = 'application/x-cosmic-card';

export interface DragPayload {
  uid: string;
  /** 'hand' = sale de tu mano (información oculta); 'board' = ya está en mesa. */
  source: 'hand' | 'board';
  from: ZoneId;
}

export function setDragPayload(event: React.DragEvent, payload: DragPayload): void {
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  // Algunos navegadores exigen text/plain para permitir el arrastre.
  event.dataTransfer.setData('text/plain', payload.uid);
  event.dataTransfer.effectAllowed = 'move';
}

export function readDragPayload(event: React.DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    return parsed?.uid ? parsed : null;
  } catch {
    return null;
  }
}
