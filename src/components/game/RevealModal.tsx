/**
 * Private reveal of the top N cards of your deck.
 *
 * Nothing moves while the modal is open: the cards stay on top of the deck
 * until you confirm, and then every card is routed in ONE event
 * (REVEAL_RESOLVE). Cancelling or closing leaves all of them on top in their
 * original order, so a card can never be lost.
 */

import { useState } from 'react';

import { CardTile } from './CardTile';
import type { PrivateCard } from '../../hooks/usePrivateDeck';
import type { RevealRoute } from '../../lib/game/events';

interface RevealModalProps {
  cards: PrivateCard[];
  onConfirm: (routes: RevealRoute[]) => void;
  onCancel: () => void;
}

const ROUTE_OPTIONS: { route: RevealRoute; label: string; hint: string }[] = [
  { route: 'hand', label: 'Mano', hint: 'A tu mano (oculta para el rival)' },
  { route: 'top', label: 'Arriba', hint: 'Vuelve arriba del mazo' },
  { route: 'bottom', label: 'Fondo', hint: 'Al fondo del mazo' },
  { route: 'void', label: 'Vacío', hint: 'Al Vacío (el rival la verá)' },
];

export function RevealModal({ cards, onConfirm, onCancel }: RevealModalProps) {
  const [routes, setRoutes] = useState<RevealRoute[]>(() => cards.map(() => 'top'));

  const setRoute = (index: number, route: RevealRoute) =>
    setRoutes((current) => current.map((value, i) => (i === index ? route : value)));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Revelar cartas del mazo"
      onClick={onCancel}
    >
      <div
        className="max-h-[85vh] w-full max-w-5xl overflow-y-auto border border-[var(--color-stroke-faint)] bg-[var(--color-hull)] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="hud-title text-sm">Revelar {cards.length} carta{cards.length === 1 ? '' : 's'}</h3>
            <p className="hud-sub mt-1 text-[9px]">
              Solo tú ves estas cartas (1 = la de arriba). Elige un destino para cada una.
              Si cancelas, todas vuelven arriba en su orden original.
            </p>
          </div>
          <button type="button" className="btn btn--sm" onClick={onCancel} title="Cancelar: nada se mueve">
            Cancelar
          </button>
        </header>

        <div className="flex flex-wrap gap-3">
          {cards.map((card, index) => (
            <div key={card.uid} className="flex flex-col items-center gap-1.5">
              <span className="hud-sub tabular text-[9px]">#{index + 1}</span>
              <CardTile def={card.def} width={130} />
              <div className="grid grid-cols-2 gap-1">
                {ROUTE_OPTIONS.map((option) => (
                  <button
                    key={option.route}
                    type="button"
                    className={`btn btn--sm ${routes[index] === option.route ? 'btn--primary' : ''}`}
                    onClick={() => setRoute(index, option.route)}
                    aria-pressed={routes[index] === option.route}
                    title={option.hint}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onConfirm(routes)}
            title="Mueve cada carta a su destino"
          >
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  );
}
