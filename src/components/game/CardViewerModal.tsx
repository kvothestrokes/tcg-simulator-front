import { useEffect, useMemo } from 'react';

import { CardTile } from './CardTile';
import { getCardSize } from '../../lib/card/getCardTypeFields';
import type { CardDef, CardInstance } from '../../lib/game/types';

interface CardViewerModalProps {
  def: CardDef;
  instance?: CardInstance;
  onClose: () => void;
}

/** Márgenes para que la carta quepa en el viewport sin tocar los bordes. */
const VIEWPORT_PADDING_X = 96;
const VIEWPORT_PADDING_Y = 128;
const MAX_PORTRAIT_WIDTH = 420;
const MAX_STATION_WIDTH = 720;

export function CardViewerModal({ def, instance, onClose }: CardViewerModalProps) {
  const { w: nativeW, h: nativeH } = getCardSize(def.tipo);

  const width = useMemo(() => {
    if (typeof window === 'undefined') return Math.min(nativeW, MAX_PORTRAIT_WIDTH);
    const maxW = window.innerWidth - VIEWPORT_PADDING_X;
    const maxH = window.innerHeight - VIEWPORT_PADDING_Y;
    const byHeight = (maxH / nativeH) * nativeW;
    const cap = def.tipo === 'Estación' ? MAX_STATION_WIDTH : MAX_PORTRAIT_WIDTH;
    return Math.max(180, Math.min(nativeW, cap, maxW, byHeight));
  }, [def.tipo, nativeH, nativeW]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={def.nombre}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <p className="hud-title text-sm">{def.nombre}</p>
          <button
            type="button"
            className="btn btn--sm"
            onClick={onClose}
            aria-label="Cerrar visualizador"
          >
            Cerrar
          </button>
        </div>
        <CardTile def={def} instance={instance} width={width} />
      </div>
    </div>
  );
}
