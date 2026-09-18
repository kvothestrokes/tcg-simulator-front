/**
 * La mesa: los dos tableros, tu mano y los controles.
 *
 * Reparto de responsabilidades, que es lo que hace que esto funcione:
 *
 *   · El servidor ordena y persiste declaraciones. No sabe qué es una carta.
 *   · El tablero compartido es una función pura del log de eventos, así que los
 *     dos jugadores ven exactamente lo mismo.
 *   · Tu mano y tu mazo nunca salen del navegador.
 *
 * Por eso no hay actualizaciones optimistas: al declarar una jugada, el tablero
 * cambia cuando el evento vuelve ya persistido. Son milisegundos, y a cambio no
 * existe ningún estado intermedio que pueda divergir entre los dos jugadores.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CardInspector, type Selection } from './CardInspector';
import { CardViewerModal } from './CardViewerModal';
import { Hand } from './Hand';
import { PlayerBoard } from './PlayerBoard';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import type { DragPayload } from './dnd';
import { Panel } from '../ui/Panel';
import { useGameRoom } from '../../hooks/useGameRoom';
import { usePrivateDeck } from '../../hooks/usePrivateDeck';
import { useSession } from '../../hooks/useSession';
import { PHASES, type CardInstance, type ZoneId } from '../../lib/game/types';
import { loginPath } from '../../lib/navigation';
import { roomPath } from '../../lib/config';
import { shortName } from '../../lib/session';

/** Zonas a las que se puede llevar una carta desde la mano. */
const HAND_TARGETS: ZoneId[] = ['battle', 'station', 'resources', 'pilots'];
/** Zonas a las que se puede mover una carta ya en mesa. */
const BOARD_TARGETS: ZoneId[] = ['battle', 'station', 'resources', 'pilots', 'void', 'deck'];

export function GameTable() {
  const code = useRoomCode();
  const { identity, loading: sessionLoading } = useSession();

  const deck = usePrivateDeck(code ?? '', identity?.userId);
  const { loading, fatalError, connection, latencyMs, lastError, state, me, opponent, actions } =
    useGameRoom({
      roomCode: code ?? '',
      userId: identity?.userId,
      onEvent: deck.applyOwnEvent,
    });

  const [selection, setSelection] = useState<Selection>(null);
  const [handCollapsed, setHandCollapsed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Sin sesión no hay sala: se vuelve al acceso conservando el código.
  useEffect(() => {
    if (sessionLoading || identity) return;
    const next = code ? roomPath(code) : null;
    window.location.href = loginPath(next);
  }, [sessionLoading, identity, code]);

  // Si la carta seleccionada desaparece del tablero (la movió el rival, o se
  // fue al Vacío), se cierra el inspector en vez de dejarlo con datos viejos.
  useEffect(() => {
    if (selection?.kind !== 'board') return;
    const stillThere = me?.cards[selection.card.uid] ?? opponent?.cards[selection.card.uid];
    if (!stillThere) {
      setSelection(null);
      setViewerOpen(false);
    } else if (stillThere !== selection.card) {
      setSelection({ kind: 'board', card: stillThere, owned: selection.owned });
    }
  }, [me?.cards, opponent?.cards, selection]);

  const canAct =
    connection === 'connected' &&
    !!me &&
    !me.left &&
    state.status !== 'finished' &&
    state.status !== 'abandoned';

  const nameFor = useCallback(
    (userId: string | undefined) => {
      if (!userId) return 'Sistema';
      if (userId === identity?.userId) return identity?.label ?? 'Tú';
      return `Rival #${shortName(userId)}`;
    },
    [identity],
  );

  /**
   * El motor escribe los textos del registro con un nombre genérico
   * (Piloto-XXXX) porque solo conoce identificadores. Aquí se sustituyen por los
   * alias de la interfaz, para TODOS los jugadores que aparezcan en la frase, no
   * solo para quien la provocó (una frase de cambio de turno nombra al rival).
   */
  const humanize = useCallback(
    (text: string) => {
      let out = text;
      for (const userId of Object.keys(state.players)) {
        out = out.split(`Piloto-${shortName(userId)}`).join(nameFor(userId));
      }
      return out;
    },
    [nameFor, state.players],
  );

  // --- acciones sobre cartas -------------------------------------------------

  const playFromHand = useCallback(
    (uid: string, to: ZoneId, options?: { faceUp?: boolean; slot?: number }) => {
      const card = deck.hand.find((entry) => entry.uid === uid);
      if (!card || !canAct) return;
      actions.playCard({
        uid: card.uid,
        def: card.def,
        from: 'hand',
        to,
        slot: options?.slot,
        faceUp: options?.faceUp ?? true,
      });
      setSelection(null);
    },
    [actions, canAct, deck.hand],
  );

  const moveOnBoard = useCallback(
    (card: CardInstance, to: ZoneId, options?: { slot?: number }) => {
      if (!canAct) return;
      if (to === 'deck') {
        actions.returnToDeck(card);
      } else {
        actions.moveCard({ uid: card.uid, from: card.zone, to, slot: options?.slot });
      }
      setSelection(null);
    },
    [actions, canAct],
  );

  const handleDropCard = useCallback(
    (payload: DragPayload, zone: ZoneId, slot?: number) => {
      if (payload.source === 'hand') {
        playFromHand(payload.uid, zone, { slot });
        return;
      }
      const card = me?.cards[payload.uid];
      if (card) moveOnBoard(card, zone, { slot });
    },
    [me?.cards, moveOnBoard, playFromHand],
  );

  /** Pulsar una zona con una carta seleccionada equivale a soltarla ahí. */
  const handleZoneClick = useCallback(
    (zone: ZoneId, slot?: number) => {
      if (!selection) return;
      if (selection.kind === 'hand') {
        playFromHand(selection.card.uid, zone, { slot });
      } else if (selection.owned) {
        moveOnBoard(selection.card, zone, { slot });
      }
    },
    [moveOnBoard, playFromHand, selection],
  );

  const targetZones = useMemo<ZoneId[]>(() => {
    if (!selection) return [];
    if (selection.kind === 'hand') return HAND_TARGETS;
    return selection.owned ? BOARD_TARGETS.filter((zone) => zone !== selection.card.zone) : [];
  }, [selection]);

  // --- turno y fase ----------------------------------------------------------

  const isMyTurn = state.activePlayerId === identity?.userId;

  const nextPhase = useCallback(() => {
    const index = PHASES.indexOf(state.phase as (typeof PHASES)[number]);
    const next = PHASES[(index + 1) % PHASES.length]!;
    actions.setPhase(next, state.turn, state.activePlayerId ?? identity?.userId);
  }, [actions, identity?.userId, state.activePlayerId, state.phase, state.turn]);

  const passTurn = useCallback(() => {
    const next = opponent?.userId ?? identity?.userId;
    actions.setPhase(PHASES[0]!, state.turn + 1, next);
  }, [actions, identity?.userId, opponent?.userId, state.turn]);

  // --- estados de carga ------------------------------------------------------

  if (!code) {
    return (
      <Centered>
        <p className="hud-title text-sm">Falta el código de sala</p>
        <a className="btn mt-4" href="/lobby/">
          Volver al hangar
        </a>
      </Centered>
    );
  }

  if (sessionLoading || loading) {
    return (
      <Centered>
        <p className="hud-sub animate-ping-slow">Entrando a la sala {code}…</p>
      </Centered>
    );
  }

  if (fatalError) {
    return (
      <Centered>
        <p className="hud-title text-sm text-[#fda4af]">No se pudo entrar</p>
        <p className="mt-2 max-w-sm text-center text-sm text-[var(--color-ink-dim)]">{fatalError}</p>
        <a className="btn mt-5" href="/lobby/">
          Volver al hangar
        </a>
      </Centered>
    );
  }

  const deckReady = (me?.deckCount ?? 0) + (me?.handCount ?? 0) > 0;

  return (
    <div className="flex h-dvh flex-col overflow-x-auto">
      <TopBar
        code={code}
        connection={connection}
        latencyMs={latencyMs}
        status={state.status}
        turn={state.turn}
        phase={state.phase}
        isMyTurn={isMyTurn}
        canAct={canAct}
        onNextPhase={nextPhase}
        onPassTurn={passTurn}
        onFinish={() => void actions.finishGame()}
        onLeave={() => {
          actions.leaveRoom();
          window.location.href = '/lobby/';
        }}
      />

      {lastError ? (
        <p className="shrink-0 border-b border-[rgba(244,63,94,0.4)] bg-[rgba(244,63,94,0.1)] px-3 py-1 text-[11px] text-[#fda4af]">
          {lastError.code}: {lastError.message}
        </p>
      ) : null}

      {/*
        La mesa necesita ancho: dos tableros completos más la columna lateral.
        Por debajo de ~1480 px se hace scroll horizontal en vez de apilar las
        zonas, porque un tablero de cartas apilado en una columna deja de
        parecerse a una mesa y se vuelve imposible de leer de un vistazo.
      */}
      <div className="flex min-h-0 min-w-[1480px] flex-1">
        {/* --- los dos tableros ------------------------------------------- */}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
          <PlayerBoard
            player={opponent}
            label={opponent ? nameFor(opponent.userId) : 'Esperando rival…'}
            isOwner={false}
            mirrored
            cardWidth={88}
            active={!!opponent && state.activePlayerId === opponent.userId}
            selectedUid={selection?.kind === 'board' ? selection.card.uid : undefined}
            onSelectCard={(card) => setSelection({ kind: 'board', card, owned: false })}
            onDropCard={() => undefined}
            onZoneClick={() => undefined}
            onHeatChange={() => undefined}
            onResourceChange={() => undefined}
          />

          {/* Línea de enfrentamiento */}
          <div className="flex shrink-0 items-center gap-3 px-1">
            <span className="connector w-10" />
            <span className="h-px flex-1 bg-[var(--color-stroke-faint)]" />
            <span className="hud-sub text-[9px]">
              {state.status === 'finished'
                ? 'Partida terminada'
                : opponent
                  ? `Turno ${state.turn} · ${state.phase}`
                  : 'Comparte el código para que entre tu rival'}
            </span>
            <span className="h-px flex-1 bg-[var(--color-stroke-faint)]" />
            <span className="connector w-10" />
          </div>

          <PlayerBoard
            player={me}
            label={identity?.label ?? 'Tú'}
            isOwner
            mirrored={false}
            cardWidth={108}
            active={isMyTurn}
            selectedUid={selection?.kind === 'board' ? selection.card.uid : undefined}
            targetZones={targetZones}
            onSelectCard={(card) => setSelection({ kind: 'board', card, owned: true })}
            onDropCard={handleDropCard}
            onZoneClick={handleZoneClick}
            onHeatChange={actions.setHeat}
            onResourceChange={actions.setResources}
            onDeckClick={() => canAct && actions.draw(1)}
          />
        </div>

        {/* --- columna lateral -------------------------------------------- */}
        <aside className="flex min-h-0 w-[360px] shrink-0 flex-col gap-1.5 overflow-y-auto p-2 pl-0">
          <Panel cut={10} className="shrink-0" innerClassName="p-2.5">
            <h3 className="hud-title mb-2 text-[11px]">Mazo</h3>
            {!deckReady ? (
              <>
                <button
                  type="button"
                  className="btn btn--primary w-full"
                  onClick={() => actions.setupDeck(deck.starterSize, 'Mazo de ejemplo')}
                  disabled={!canAct}
                >
                  Preparar mazo ({deck.starterSize})
                </button>
                <p className="hud-sub mt-2 text-[9px] leading-relaxed">
                  Baraja el mazo de ejemplo en tu navegador. El rival solo verá cuántas
                  cartas tienes.
                </p>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <button className="btn btn--sm" type="button" onClick={() => actions.draw(1)} disabled={!canAct}>
                  Robar 1
                </button>
                <button className="btn btn--sm" type="button" onClick={() => actions.draw(5)} disabled={!canAct}>
                  Robar 5
                </button>
                <button
                  className="btn btn--sm"
                  type="button"
                  onClick={() => actions.shuffleDeck(deck.deck.length)}
                  disabled={!canAct}
                >
                  Barajar
                </button>
                <button className="btn btn--sm" type="button" onClick={() => actions.rollDice(6)} disabled={!canAct}>
                  Dado d6
                </button>
                <button
                  className="btn btn--sm btn--ghost col-span-2"
                  type="button"
                  onClick={() => {
                    if (confirm('¿Reiniciar la mesa? Se vacían las zonas de los dos jugadores.')) {
                      actions.resetTable();
                    }
                  }}
                  disabled={!canAct}
                >
                  Reiniciar mesa
                </button>
              </div>
            )}
          </Panel>

          <CardInspector
            selection={selection}
            onClose={() => {
              setSelection(null);
              setViewerOpen(false);
            }}
            onEnlarge={() => setViewerOpen(true)}
            onPlay={(to, options) => {
              if (selection?.kind === 'hand') playFromHand(selection.card.uid, to, options);
            }}
            onMove={(to, options) => {
              if (selection?.kind === 'board' && selection.owned) {
                moveOnBoard(selection.card, to, options);
              }
            }}
            onTap={(tapped) => {
              if (selection?.kind === 'board') actions.tapCard(selection.card.uid, tapped);
            }}
            onFlip={(faceUp) => {
              if (selection?.kind === 'board') actions.flipCard(selection.card.uid, faceUp);
            }}
            onCounter={(key, value) => {
              if (selection?.kind === 'board') actions.setCounter(selection.card.uid, key, value);
            }}
            onToHand={() => {
              if (selection?.kind === 'board' && selection.owned) {
                actions.returnToHand(selection.card);
                setSelection(null);
              }
            }}
            onToDeck={() => {
              if (selection?.kind === 'board' && selection.owned) {
                actions.returnToDeck(selection.card);
                setSelection(null);
              }
            }}
            onDiscardFromHand={() => {
              if (selection?.kind === 'hand') {
                playFromHand(selection.card.uid, 'void', { faceUp: true });
              }
            }}
          />

          <SidePanel
            log={state.log}
            myUserId={identity?.userId}
            nameFor={nameFor}
            humanize={humanize}
            onSendChat={actions.sendChat}
            disabled={connection !== 'connected'}
          />
        </aside>
      </div>

      <Hand
        cards={deck.hand}
        selectedUid={selection?.kind === 'hand' ? selection.card.uid : undefined}
        onSelect={(card) => setSelection({ kind: 'hand', card })}
        cardWidth={104}
        collapsed={handCollapsed}
        onToggle={() => setHandCollapsed((value) => !value)}
      />

      {viewerOpen && selection ? (
        <CardViewerModal
          def={selection.kind === 'hand' ? selection.card.def : selection.card.def}
          instance={selection.kind === 'board' ? selection.card : undefined}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  );
}

// --- utilidades --------------------------------------------------------------

/**
 * El código de sala viaja en la query porque la app es estática.
 *
 * Se lee en el inicializador perezoso del estado y no en un efecto, para que el
 * primer render ya tenga el código y no se vea un parpadeo de «falta el código».
 */
function useRoomCode(): string | null {
  const [code] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? null;
  });
  return code;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center px-6">{children}</div>
  );
}
