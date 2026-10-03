/**
 * Tu mano. Es la única información oculta del simulador: vive en local y el
 * rival solo ve cuántas cartas tienes.
 *
 * Overlay fijo en abanico: en reposo asoma el 40% y al pasar el puntero se
 * despliega, endereza la carta enfocada y aparta a las vecinas.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { CardTile } from './CardTile';
import { setDragPayload } from './dnd';
import type { PrivateCard } from '../../hooks/usePrivateDeck';
import { CARD_SIZE_PORTRAIT } from '../../lib/card/getCardTypeFields';
import { fanLayout, fanPeekHeight } from '../../lib/ui/handFan';

const HAND_CARD_WIDTH = 104;
const HAND_CARD_HEIGHT = HAND_CARD_WIDTH * (CARD_SIZE_PORTRAIT.h / CARD_SIZE_PORTRAIT.w);

interface HandProps {
  cards: PrivateCard[];
  selectedUid?: string;
  onSelect: (card: PrivateCard) => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export function Hand({ cards, selectedUid, onSelect, pinned, onTogglePin }: HandProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chromeHover, setChromeHover] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [maxWidth, setMaxWidth] = useState(720);
  const leaveTimer = useRef<number>(0);

  useEffect(() => {
    const update = () => setMaxWidth(Math.min(920, Math.max(280, window.innerWidth - 48)));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const keepOpen = () => {
    window.clearTimeout(leaveTimer.current);
  };

  const scheduleClose = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setHoveredIndex(null);
      setChromeHover(false);
    }, 140);
  };

  const expanded = !dragging && (pinned || hoveredIndex !== null || chromeHover || focusInside);

  const slots = useMemo(
    () =>
      fanLayout({
        count: cards.length,
        cardWidth: HAND_CARD_WIDTH,
        cardHeight: HAND_CARD_HEIGHT,
        maxWidth,
        hoveredIndex,
        expanded,
      }),
    [cards.length, expanded, hoveredIndex, maxWidth],
  );

  const selectedLift = expanded ? 10 : 18;
  const railHeight = expanded ? HAND_CARD_HEIGHT * 1.75 : fanPeekHeight(HAND_CARD_HEIGHT) + 36;

  return (
    <div className="hand-fan" aria-label="Tu mano">
      <div
        className="relative w-full"
        style={{ height: railHeight }}
        onFocusCapture={() => setFocusInside(true)}
        onBlurCapture={(event) => {
          const next = event.relatedTarget as Node | null;
          if (!event.currentTarget.contains(next)) setFocusInside(false);
        }}
      >
        <div
          className="pointer-events-auto absolute bottom-[calc(40%+10px)] left-1/2 z-[20] flex -translate-x-1/2 items-center gap-2 rounded-sm bg-[rgba(8,10,18,0.72)] px-2 py-1 backdrop-blur"
          onPointerEnter={() => {
            keepOpen();
            setChromeHover(true);
          }}
          onPointerLeave={scheduleClose}
        >
          <span className="hud-title text-aurora text-[10px]">Mano</span>
          <span className="hud-sub tabular">{cards.length}</span>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={onTogglePin}
            aria-pressed={pinned}
            title={pinned ? 'Dejar de fijar la mano' : 'Fijar la mano desplegada'}
          >
            {pinned ? 'Fijada' : 'Fijar mano'}
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 hud-sub text-[10px] opacity-60">
            No tienes cartas. Roba del mazo para empezar.
          </p>
        ) : (
          cards.map((card, index) => {
            const slot = slots[index];
            if (!slot) return null;
            const selected = selectedUid === card.uid;
            const lift = selected ? selectedLift : 0;
            return (
              <div
                key={card.uid}
                className="hand-fan__slot"
                style={{
                  width: HAND_CARD_WIDTH,
                  zIndex: selected ? slot.z + 8 : slot.z,
                  transform: `translateX(-50%) translate(${slot.x}px, ${slot.y - lift}px) rotate(${slot.rotate}deg) scale(${slot.scale})`,
                  animationDelay: `${Math.min(index, 8) * 35}ms`,
                }}
                onPointerEnter={() => {
                  keepOpen();
                  setHoveredIndex(index);
                }}
                onPointerLeave={scheduleClose}
              >
                <CardTile
                  def={card.def}
                  width={HAND_CARD_WIDTH}
                  selected={selected}
                  draggable
                  className="game-card--in-fan"
                  onClick={() => onSelect(card)}
                  onDragStart={(event) => {
                    setDragging(true);
                    setHoveredIndex(null);
                    setChromeHover(false);
                    setDragPayload(event, { uid: card.uid, source: 'hand', from: 'hand' });
                  }}
                  onDragEnd={() => setDragging(false)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export const HAND_TABLE_PADDING = fanPeekHeight(HAND_CARD_HEIGHT) + 16;
