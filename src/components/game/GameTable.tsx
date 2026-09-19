/**
 * La mesa: los dos tableros, tu mano y los controles.
 *
 * El servidor ordena y persiste declaraciones. El tablero compartido es una
 * función pura del log de eventos. La mano y el mazo nunca salen del navegador.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CardInspector, type Selection } from './CardInspector';
import { CardViewerModal } from './CardViewerModal';
import { CardContextMenu, type ContextMenuState } from './CardContextMenu';
import { CenterStrip } from './CenterStrip';
import { DiscardViewer } from './DiscardViewer';
import { Hand } from './Hand';
import { PlayerBoard } from './PlayerBoard';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import type { DragPayload } from './dnd';
import { Panel } from '../ui/Panel';
import { useGameRoom } from '../../hooks/useGameRoom';
import { usePrivateDeck } from '../../hooks/usePrivateDeck';
import { useSelectedLoadout } from '../../hooks/useSelectedLoadout';
import { useSession } from '../../hooks/useSession';
import {
  DAMAGE_COUNTER,
  PHASES,
  cardsInZone,
  normalizePhase,
  type CardInstance,
  type ZoneId,
} from '../../lib/game/types';
import { canLinkTo, firstEmptyBattleSlot, isRootShip, shipInSlot } from '../../lib/game/rules';
import { loginPath } from '../../lib/navigation';
import { roomPath } from '../../lib/config';
import { shortName } from '../../lib/session';

const HAND_TARGETS: ZoneId[] = ['battle', 'station', 'resources', 'pilots'];
const BOARD_TARGETS: ZoneId[] = ['battle', 'station', 'resources', 'pilots', 'void', 'deck'];

export function GameTable() {
  const code = useRoomCode();
  const { identity, loading: sessionLoading } = useSession();

  const loadout = useSelectedLoadout(identity?.userId);
  const deck = usePrivateDeck(code ?? '', identity?.userId, loadout.cardIds);
  const { loading, fatalError, connection, latencyMs, lastError, state, me, opponent, actions } =
    useGameRoom({
      roomCode: code ?? '',
      userId: identity?.userId,
      onEvent: deck.applyOwnEvent,
    });

  const [selection, setSelection] = useState<Selection>(null);
  const [hoverCard, setHoverCard] = useState<CardInstance | null>(null);
  const [handCollapsed, setHandCollapsed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [attackSourceUid, setAttackSourceUid] = useState<string | undefined>();

  useEffect(() => {
    if (sessionLoading || identity) return;
    const next = code ? roomPath(code) : null;
    window.location.href = loginPath(next);
  }, [sessionLoading, identity, code]);

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

  const playFromHand = useCallback(
    (uid: string, to: ZoneId, options?: { faceUp?: boolean; slot?: number; attachedTo?: string }) => {
      const card = deck.hand.find((entry) => entry.uid === uid);
      if (!card || !canAct) return;
      actions.playCard({
        uid: card.uid,
        def: card.def,
        from: 'hand',
        to,
        slot: options?.slot,
        faceUp: options?.faceUp ?? true,
        attachedTo: options?.attachedTo,
      });
      setSelection(null);
    },
    [actions, canAct, deck.hand],
  );

  const moveOnBoard = useCallback(
    (card: CardInstance, to: ZoneId, options?: { slot?: number; attachedTo?: string | null }) => {
      if (!canAct) return;
      if (to === 'deck') {
        actions.returnToDeck(card);
      } else {
        actions.moveCard({
          uid: card.uid,
          from: card.zone,
          to,
          slot: options?.slot,
          attachedTo: options?.attachedTo,
        });
      }
      setSelection(null);
    },
    [actions, canAct],
  );

  const handleDropCard = useCallback(
    (payload: DragPayload, zone: ZoneId, slot?: number) => {
      if (payload.source === 'hand') {
        const card = deck.hand.find((entry) => entry.uid === payload.uid);
        if (zone === 'battle' && slot !== undefined && card && me) {
          const occupant = shipInSlot(me, slot);
          if (occupant && (card.def.tipo === 'Gear' || card.def.tipo === 'Piloto')) {
            if (canLinkTo(me, occupant, { ...occupant, uid: card.uid, def: card.def, zone: 'hand', ownerId: me.userId, faceUp: true, tapped: false, counters: {} })) {
              playFromHand(payload.uid, 'battle', { slot, attachedTo: occupant.uid });
              return;
            }
          }
          if (occupant && card.def.tipo === 'Nave') return;
        }
        playFromHand(payload.uid, zone, { slot });
        return;
      }
      const card = me?.cards[payload.uid];
      if (!card || !me) return;
      if (zone === 'battle' && slot !== undefined) {
        const occupant = shipInSlot(me, slot);
        if (occupant && canLinkTo(me, occupant, card)) {
          actions.linkCard(card.uid, occupant.uid);
          return;
        }
      }
      moveOnBoard(card, zone, { slot });
    },
    [actions, deck.hand, me, moveOnBoard, playFromHand],
  );

  const handleZoneClick = useCallback(
    (zone: ZoneId, slot?: number) => {
      if (attackSourceUid) return;
      if (!selection) return;
      if (selection.kind === 'hand') {
        playFromHand(selection.card.uid, zone, { slot });
      } else if (selection.owned) {
        moveOnBoard(selection.card, zone, { slot });
      }
    },
    [attackSourceUid, moveOnBoard, playFromHand, selection],
  );

  const targetZones = useMemo<ZoneId[]>(() => {
    if (!selection) return [];
    if (selection.kind === 'hand') return HAND_TARGETS;
    return selection.owned ? BOARD_TARGETS.filter((zone) => zone !== selection.card.zone) : [];
  }, [selection]);

  const isMyTurn = !state.activePlayerId || state.activePlayerId === identity?.userId;

  const nextPhase = useCallback(() => {
    if (!canAct || !identity?.userId) return;
    if (!state.activePlayerId) {
      actions.startTurn(state.turn, identity.userId);
      return;
    }
    if (state.activePlayerId !== identity.userId) return;
    const phase = normalizePhase(state.phase);
    const index = PHASES.indexOf(phase);
    if (phase === 'Final') {
      const next = opponent?.userId ?? identity.userId;
      actions.startTurn(state.turn + 1, next);
      return;
    }
    const next = PHASES[index + 1] ?? 'Principal';
    actions.setPhase(next, state.turn, identity.userId);
  }, [actions, canAct, identity?.userId, opponent?.userId, state.activePlayerId, state.phase, state.turn]);

  const inspectCard = useCallback((card: CardInstance) => {
    setSelection({ kind: 'board', card, owned: card.ownerId === identity?.userId });
    if (card.def.tipo === 'Nave') setViewerOpen(true);
    else if (canAct && card.ownerId === identity?.userId) actions.tapCard(card.uid, !card.tapped);
  }, [actions, canAct, identity?.userId]);

  const openMenu = useCallback((card: CardInstance, event: React.MouseEvent, owned: boolean) => {
    setMenu({ x: event.clientX, y: event.clientY, card, owned });
  }, []);

  const handleAttackTarget = useCallback(
    (target: CardInstance) => {
      if (!attackSourceUid || !canAct) return;
      actions.attack(attackSourceUid, target.ownerId, target.uid);
      setAttackSourceUid(undefined);
    },
    [actions, attackSourceUid, canAct],
  );

  const spawnToken = useCallback(() => {
    if (!canAct || !me) return;
    const slot = firstEmptyBattleSlot(me);
    if (slot === undefined) return;
    actions.spawnToken(slot);
  }, [actions, canAct, me]);

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
  const gameOverText = state.winnerId
    ? `Victoria: ${nameFor(state.winnerId)}${state.endReason ? ` (${state.endReason})` : ''}`
    : undefined;
  const inspectorCard =
    hoverCard ?? (selection?.kind === 'board' ? selection.card : undefined);
  const inspectorOwner = inspectorCard
    ? inspectorCard.ownerId === identity?.userId
      ? me
      : opponent
    : undefined;

  return (
    <div className="flex h-dvh flex-col overflow-x-auto">
      <TopBar
        code={code}
        connection={connection}
        latencyMs={latencyMs}
        status={state.status}
        turn={state.turn}
        phase={normalizePhase(state.phase)}
        isMyTurn={Boolean(state.activePlayerId) && state.activePlayerId === identity?.userId}
        canAct={canAct}
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

      {attackSourceUid ? (
        <p className="shrink-0 bg-[rgba(103,232,249,0.12)] px-3 py-1 text-[11px] text-[var(--color-signal)]">
          Elige objetivo (nave o estación enemiga).{' '}
          <button type="button" className="underline" onClick={() => setAttackSourceUid(undefined)}>
            Cancelar
          </button>
        </p>
      ) : null}

      <div className="flex min-h-0 min-w-[1480px] flex-1">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
          <PlayerBoard
            player={opponent}
            label={opponent ? nameFor(opponent.userId) : 'Esperando rival…'}
            isOwner={false}
            mirrored
            cardWidth={88}
            active={!!opponent && state.activePlayerId === opponent.userId}
            selectedUid={selection?.kind === 'board' ? selection.card.uid : undefined}
            hoverUid={hoverCard?.uid}
            attackSourceUid={attackSourceUid}
            onSelectCard={(card) => setSelection({ kind: 'board', card, owned: false })}
            onHoverCard={setHoverCard}
            onDropCard={() => undefined}
            onZoneClick={() => undefined}
            onHeatChange={() => undefined}
            onAttackTarget={handleAttackTarget}
          />

          <CenterStrip
            sharedCount={state.sharedResourceDeckCount}
            phase={state.phase}
            turn={state.turn}
            isMyTurn={isMyTurn}
            canAct={canAct}
            gameOverText={gameOverText}
            onAdvancePhase={nextPhase}
            onSpawnToken={spawnToken}
          />

          <PlayerBoard
            player={me}
            label={identity?.label ?? 'Tú'}
            isOwner
            mirrored={false}
            cardWidth={108}
            active={Boolean(state.activePlayerId) && state.activePlayerId === identity?.userId}
            selectedUid={selection?.kind === 'board' ? selection.card.uid : undefined}
            hoverUid={hoverCard?.uid}
            targetZones={targetZones}
            onSelectCard={(card) => setSelection({ kind: 'board', card, owned: true })}
            onHoverCard={setHoverCard}
            onDoubleClickCard={inspectCard}
            onContextMenuCard={(card, event) => openMenu(card, event, true)}
            onDropCard={handleDropCard}
            onZoneClick={handleZoneClick}
            onHeatChange={actions.setHeat}
            onDeckClick={() => canAct && actions.draw(1)}
            onVoidClick={() => setDiscardOpen(true)}
          />
        </div>

        <aside className="flex min-h-0 w-[360px] shrink-0 flex-col gap-1.5 overflow-y-auto p-2 pl-0">
          <Panel cut={10} className="shrink-0" innerClassName="p-2.5">
            <h3 className="hud-title mb-2 text-[11px]">Mazo</h3>
            {!deckReady ? (
              <>
                <button
                  type="button"
                  className="btn btn--primary w-full"
                  onClick={() =>
                    actions.setupDeck(
                      deck.deckSize,
                      loadout.deckName ?? 'Mazo de ejemplo',
                      loadout.station ?? undefined,
                    )
                  }
                  disabled={!canAct}
                >
                  Preparar mazo ({deck.deckSize})
                </button>
                <p className="hud-sub mt-2 text-[9px] leading-relaxed">
                  {loadout.ready ? (
                    <>
                      Mazo elegido:{' '}
                      <span className="text-[var(--color-signal)]">{loadout.deckName}</span>. Se baraja
                      en tu navegador; el rival solo verá cuántas cartas tienes.
                    </>
                  ) : (
                    <>
                      No elegiste mazo en el hangar: se usará el de ejemplo.{' '}
                      <a className="underline" href="/lobby">
                        Elegir mazo
                      </a>
                      .
                    </>
                  )}
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
                {opponent ? (
                  <button
                    className="btn btn--sm btn--ghost col-span-2"
                    type="button"
                    onClick={() => actions.concede(opponent.userId)}
                    disabled={!canAct}
                  >
                    Conceder
                  </button>
                ) : null}
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
            hover={hoverCard}
            owner={inspectorOwner}
            ships={inspectorOwner ? Object.values(inspectorOwner.cards).filter(isRootShip) : []}
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
            onLink={(parentUid) => {
              if (selection?.kind === 'board' && selection.owned) {
                actions.linkCard(selection.card.uid, parentUid);
              } else if (selection?.kind === 'hand') {
                const ship = me?.cards[parentUid];
                if (ship) playFromHand(selection.card.uid, 'battle', { slot: ship.slot, attachedTo: parentUid });
              }
            }}
            onUnlink={() => {
              if (selection?.kind === 'board' && selection.owned) actions.unlinkCard(selection.card.uid);
            }}
            onAttack={() => {
              if (selection?.kind === 'board' && selection.owned) setAttackSourceUid(selection.card.uid);
            }}
            onDestroy={() => {
              if (selection?.kind === 'board' && selection.owned) {
                actions.destroyCard(selection.card.uid);
                setSelection(null);
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

      {discardOpen && me ? (
        <DiscardViewer
          cards={cardsInZone(me, 'void')}
          onClose={() => setDiscardOpen(false)}
          onSelect={(card) => {
            setSelection({ kind: 'board', card, owned: true });
            setDiscardOpen(false);
          }}
        />
      ) : null}

      {menu ? (
        <CardContextMenu
          menu={menu}
          canAct={canAct}
          onClose={() => setMenu(null)}
          onTap={(tapped) => {
            actions.tapCard(menu.card.uid, tapped);
            setMenu(null);
          }}
          onDamage={(value) => {
            actions.setCounter(menu.card.uid, DAMAGE_COUNTER, value);
            setMenu(null);
          }}
          onToVoid={() => {
            moveOnBoard(menu.card, 'void');
            setMenu(null);
          }}
          onToHand={() => {
            actions.returnToHand(menu.card);
            setMenu(null);
          }}
          onToDeck={(position) => {
            actions.returnToDeck(menu.card, position);
            setMenu(null);
          }}
          onUnlink={
            menu.card.attachedTo
              ? () => {
                  actions.unlinkCard(menu.card.uid);
                  setMenu(null);
                }
              : undefined
          }
          onAttack={
            menu.card.def.tipo === 'Nave'
              ? () => {
                  setAttackSourceUid(menu.card.uid);
                  setMenu(null);
                }
              : undefined
          }
          onDestroy={
            menu.card.def.tipo === 'Nave'
              ? () => {
                  actions.destroyCard(menu.card.uid);
                  setMenu(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

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
