/**
 * Floating control panel of the offline test mode (`/room/?test=1`).
 *
 * Rendered by RoomScreen next to the table, never inside it. Lets one person
 * drive both seats (hot-seat: switching side flips the board), re-prepare the
 * decks after an in-game reset, and wipe the whole test game.
 */

import { useEffect, useState } from 'react';

import { useTestRoom } from '@/hooks/useTestRoom';
import { TEST_PLAYER_ID, TEST_RIVAL_ID, hardResetTestRoom, prepareSeats, type TestActor } from '@/lib/testMode';

const SIDES: { actor: TestActor; label: string }[] = [
  { actor: 'me', label: 'Yo' },
  { actor: 'rival', label: 'Rival' },
];

export function TestModePanel() {
  const { room, state, actor, setActor } = useTestRoom();
  const [open, setOpen] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = window.setTimeout(() => setConfirmReset(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmReset]);

  const meReady = Boolean(state.players[TEST_PLAYER_ID]?.ready);
  const rivalReady = Boolean(state.players[TEST_RIVAL_ID]?.ready);
  const closed = state.status === 'finished' || state.status === 'abandoned';
  const activeLabel = !state.activePlayerId
    ? 'nadie (pulsa «Siguiente fase» para empezar)'
    : state.activePlayerId === TEST_PLAYER_ID
      ? 'Yo'
      : 'Rival';

  return (
    <div
      className="fixed bottom-3 left-3 z-[var(--z-zoom)] w-64 border border-dashed border-amber-400/70 bg-black/85 p-2.5 text-[11px] text-amber-100 shadow-lg backdrop-blur"
      role="region"
      aria-label="Modo prueba"
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="tracking-wider text-amber-300">MODO PRUEBA (sin backend)</strong>
        <button
          type="button"
          className="px-1 text-amber-300 hover:text-amber-100"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          title={open ? 'Minimizar' : 'Mostrar'}
        >
          {open ? '–' : '+'}
        </button>
      </div>

      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <p className="mb-1 opacity-80">Jugar como:</p>
            <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Jugar como">
              {SIDES.map((side) => (
                <button
                  key={side.actor}
                  type="button"
                  role="radio"
                  aria-checked={actor === side.actor}
                  className={`border px-2 py-1 ${
                    actor === side.actor
                      ? 'border-amber-300 bg-amber-300 font-semibold text-black'
                      : 'border-amber-400/50 hover:bg-amber-400/10'
                  }`}
                  onClick={() => setActor(side.actor)}
                >
                  {side.label}
                </button>
              ))}
            </div>
            <p className="mt-1 opacity-70">
              Turno {state.turn} · activo: {activeLabel}
            </p>
          </div>

          <button
            type="button"
            className="border border-amber-400/50 px-2 py-1 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={closed || (meReady && rivalReady)}
            onClick={() => prepareSeats(room, state)}
            title="Declara SETUP con el mazo de ejemplo para cada asiento que no esté listo."
          >
            Preparar mazos {meReady && rivalReady ? '(listos)' : ''}
          </button>

          <button
            type="button"
            className={`border px-2 py-1 ${
              confirmReset
                ? 'border-red-400 bg-red-500/80 font-semibold text-white'
                : 'border-red-400/60 text-red-200 hover:bg-red-500/15'
            }`}
            onClick={() => (confirmReset ? hardResetTestRoom() : setConfirmReset(true))}
          >
            {confirmReset ? '¿Seguro? Pulsa otra vez' : 'Reiniciar mesa de prueba'}
          </button>

          <p className="leading-snug opacity-60">
            Todo ocurre en este navegador: no hay servidor ni rival real. Cambiar de lado gira la
            mesa y muestra la mano de ese asiento.
          </p>
        </div>
      ) : null}
    </div>
  );
}
