/**
 * La mesa: los dos tableros, tu mano y los controles.
 *
 * El servidor ordena y persiste declaraciones. El tablero compartido es una
 * función pura del log de eventos. La mano y el mazo nunca salen del navegador.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CardInspector, type Selection } from './CardInspector';
import { CardHoverZoom } from './CardHoverZoom';
import { CardViewerModal } from './CardViewerModal';
import { CardContextMenu, type ContextMenuState } from './CardContextMenu';
import { CenterStrip } from './CenterStrip';
import { DeckActions, type DeckActionBlocks } from './DeckActions';
import { DiscardViewer } from './DiscardViewer';
import { Hand, HAND_TABLE_PADDING } from './Hand';
import { PlayerBoard } from './PlayerBoard';
import { RevealModal } from './RevealModal';
import { RulesModal } from './RulesModal';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import type { DragPayload } from './dnd';
import { Panel } from '../ui/Panel';
import { useGameRoom } from '../../hooks/useGameRoom';
import { usePrivateDeck, type PrivateCard } from '../../hooks/usePrivateDeck';
import { useSelectedLoadout } from '../../hooks/useSelectedLoadout';
import { useSession } from '../../hooks/useSession';
import {
  CHARGE_COUNTER,
  DAMAGE_COUNTER,
  PHASES,
  cardsInZone,
  normalizePhase,
  type CardInstance,
  type ZoneId,
} from '../../lib/game/types';
import type { RevealRoute } from '../../lib/game/events';
import { nextTransition } from '../../lib/game/phaseInfo';
import {
  canLinkTo,
  costBlock,
  deckActionBlock,
  firstEmptyBattleSlot,
  isRootShip,
  playPaysCost,
  shipInSlot,
} from '../../lib/game/rules';
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
  const [zoomCard, setZoomCard] = useState<CardInstance | null>(null);
  const [handPinned, setHandPinned] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  /** Whose void is open in the viewer (the opponent's is read-only). */
  const [discardOwner, setDiscardOwner] = useState<'me' | 'opponent' | null>(null);
  const [voidZoom, setVoidZoom] = useState<CardInstance | null>(null);
  /** Snapshot of the top cards being revealed (private, local only). */
  const [revealCards, setRevealCards] = useState<PrivateCard[] | null>(null);
  const [revealCount, setRevealCount] = useState(3);
  /** Short-lived Spanish message for rejected actions (no alert()). */
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [attackSourceUid, setAttackSourceUid] = useState<string | undefined>();

  // Zoom flotante: aparece tras un instante de hover para no parpadear al
  // barrer el tablero, y se apaga en cuanto sueltas la carta.
  useEffect(() => {
    if (!hoverCard) {
      setZoomCard(null);
      return;
    }
    const timer = window.setTimeout(() => setZoomCard(hoverCard), 220);
    return () => window.clearTimeout(timer);
  }, [hoverCard]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
      // Same check the reducer runs: an unaffordable play would be rejected.
      const block = playPaysCost({ from: 'hand', to }) ? costBlock(me, card.def) : null;
      if (block) {
        setNotice(`No puedes jugar ${card.def.nombre}. ${block}`);
        return;
      }
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
    [actions, canAct, deck.hand, me],
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

  const resourceDrawnThisTurn = me?.lastResourceDrawTurn === state.turn;
  const canDrawResource =
    canAct && isMyTurn && state.sharedResourceDeckCount > 0 && !resourceDrawnThisTurn;
  const drawSharedResource = useCallback(() => {
    if (!canAct || !isMyTurn || state.sharedResourceDeckCount <= 0) return;
    actions.drawSharedResource();
  }, [actions, canAct, isMyTurn, state.sharedResourceDeckCount]);

  const transition = useMemo(
    () => nextTransition(state, identity?.userId, opponent?.userId),
    [identity?.userId, opponent?.userId, state],
  );

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

  // --- automatic deck preparation ------------------------------------------
  // SETUP (shuffle + opening hand of 5) is declared on its own once you are
  // seated, the initial sync finished and your chosen deck resolved. It is
  // derived from state (`me.ready`), so a reload or reconnect of a prepared
  // player never re-runs it; the ref only stops duplicates while the event is
  // in flight. A RESET clears `ready`, so the next game prepares itself too.
  const prepareDeck = useCallback(() => {
    // No starter-deck fallback: an illegal or missing deck never reaches SETUP.
    if (loadout.playBlock) return;
    actions.setupDeck(
      deck.deckSize,
      loadout.deckName ?? 'Mazo de ejemplo',
      loadout.station ?? undefined,
    );
  }, [actions, deck.deckSize, loadout.deckName, loadout.playBlock, loadout.station]);

  const autoSetupSent = useRef(false);
  const meReady = Boolean(me?.ready);
  const meSeated = Boolean(me);
  useEffect(() => {
    if (connection !== 'connected' || meReady) {
      autoSetupSent.current = false;
      return;
    }
    if (!canAct || !meSeated || !loadout.resolved || loadout.playBlock || autoSetupSent.current) return;
    autoSetupSent.current = true;
    prepareDeck();
  }, [canAct, connection, loadout.playBlock, loadout.resolved, meReady, meSeated, prepareDeck]);

  // --- deck actions ----------------------------------------------------------
  const myId = identity?.userId;
  const deckBlocks = useMemo<DeckActionBlocks>(() => {
    const offline = canAct ? null : 'Sin conexión o partida cerrada.';
    const topMissing = deck.deck.length === 0 ? 'Tu mazo está vacío.' : null;
    return {
      draw: offline ?? topMissing,
      extraDraw: offline ?? deckActionBlock(state, myId, 'extraDraw'),
      reveal:
        offline ??
        deckActionBlock(state, myId, 'reveal', revealCount) ??
        (deck.deck.length < revealCount ? 'No quedan tantas cartas en el mazo.' : null),
      mill: offline ?? deckActionBlock(state, myId, 'mill') ?? topMissing,
      recycle: offline ?? deckActionBlock(state, myId, 'recycle') ?? topMissing,
    };
  }, [canAct, deck.deck.length, myId, revealCount, state]);

  const startReveal = useCallback(() => {
    if (deckBlocks.reveal) return;
    const top = deck.deck.slice(0, revealCount);
    actions.reveal(top.length);
    setRevealCards(top);
  }, [actions, deck.deck, deckBlocks.reveal, revealCount]);

  const confirmReveal = useCallback(
    (routes: RevealRoute[]) => {
      const snapshot = revealCards;
      setRevealCards(null);
      if (!snapshot || !canAct) return;
      // The deck is private and only your own events change it, but if it did
      // change while the modal was open, routing by position would misfire.
      const current = deck.deck.slice(0, snapshot.length);
      if (current.some((card, index) => card.uid !== snapshot[index]?.uid)) {
        setNotice('Tu mazo cambió mientras revelabas; vuelve a revelar.');
        return;
      }
      const voidCards = snapshot.flatMap((card, index) =>
        routes[index] === 'void' ? [{ index, uid: card.uid, def: card.def }] : [],
      );
      actions.resolveReveal(routes, voidCards);
    },
    [actions, canAct, deck.deck, revealCards],
  );

  const millTop = useCallback(() => {
    const top = deck.deck[0];
    if (deckBlocks.mill || !top) return;
    actions.mill(top);
  }, [actions, deck.deck, deckBlocks.mill]);

  const recycleTop = useCallback(() => {
    const top = deck.deck[0];
    if (deckBlocks.recycle || !top) return;
    actions.recycle(top);
  }, [actions, deck.deck, deckBlocks.recycle]);

  const activateOrder = useCallback(
    (card: PrivateCard) => {
      if (!canAct) return;
      const block = costBlock(me, card.def);
      if (block) {
        setNotice(`No puedes activar ${card.def.nombre}. ${block}`);
        return;
      }
      actions.activateOrder(card);
      setSelection(null);
    },
    [actions, canAct, me],
  );

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

  const deckReady = Boolean(me?.ready);
  const handPlayBlock =
    selection?.kind === 'hand' ? costBlock(me, selection.card.def) : null;
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
        onOpenRules={() => setRulesOpen(true)}
        onFinish={() => void actions.finishGame()}
        onLeave={() => {
          actions.leaveRoom();
          window.location.href = '/lobby/';
        }}
      />

      {lastError || notice ? (
        <div className="toast-stack">
          {lastError ? (
            <p className="toast toast--danger">
              {lastError.code}: {lastError.message}
            </p>
          ) : null}
          {notice ? (
            <p className="toast" role="status">
              {notice}
            </p>
          ) : null}
        </div>
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
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2" style={{ paddingBottom: HAND_TABLE_PADDING }}>
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
            onVoidClick={() => setDiscardOwner('opponent')}
            onAttackTarget={handleAttackTarget}
          />

          <CenterStrip
            sharedCount={state.sharedResourceDeckCount}
            phase={state.phase}
            turn={state.turn}
            isMyTurn={isMyTurn}
            canAct={canAct}
            canDrawResource={canDrawResource}
            resourceDrawnThisTurn={resourceDrawnThisTurn}
            transition={transition}
            battleFull={firstEmptyBattleSlot(me) === undefined}
            gameOverText={gameOverText}
            onAdvancePhase={nextPhase}
            onDrawResource={drawSharedResource}
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
            onVoidClick={() => setDiscardOwner('me')}
          />
        </div>

        <button
          type="button"
          className="hud-sub flex w-5 shrink-0 items-center justify-center border-l border-[var(--color-stroke-faint)] hover:bg-[rgba(255,255,255,0.04)]"
          onClick={() => setSidebarOpen((open) => !open)}
          title={sidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          aria-label={sidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
        >
          {sidebarOpen ? '▸' : '◂'}
        </button>

        {sidebarOpen ? (
        <aside className="flex min-h-0 w-[340px] shrink-0 flex-col gap-1.5 overflow-y-auto p-2 pl-0">
          <Panel cut={10} className="shrink-0" innerClassName="p-2.5">
            <h3 className="hud-title mb-2 text-[11px]">Mazo</h3>
            {!deckReady ? (
              <>
                <p className="hud-sub text-[10px] leading-relaxed">
                  {!loadout.resolved
                    ? 'Cargando tu mazo…'
                    : loadout.playBlock
                      ? 'No se puede preparar la partida con este mazo.'
                      : `Preparando mazo (${deck.deckSize}) y mano inicial de 5…`}
                </p>
                {/* Recovery only: the automatic SETUP is sent once per connection,
                    and a message dropped by the socket or refused by the server
                    (rate limit) is not retried on its own. */}
                <button
                  type="button"
                  className="btn btn--sm btn--ghost mt-1.5 w-full"
                  onClick={prepareDeck}
                  disabled={!canAct || !loadout.resolved || Boolean(loadout.playBlock)}
                  title={
                    loadout.playBlock
                      ? `No disponible: ${loadout.playBlock}`
                      : !canAct
                        ? 'No disponible: sin conexión o partida cerrada.'
                        : !loadout.resolved
                          ? 'No disponible: tu mazo aún se está cargando.'
                          : 'Solo si la preparación automática no llega: vuelve a declarar el mazo'
                  }
                >
                  Reintentar preparación
                </button>
                <p className="hud-sub mt-2 text-[9px] leading-relaxed">
                  {loadout.playBlock && loadout.resolved ? (
                    <span className="text-[#fda4af]">
                      {loadout.playBlock}{' '}
                      <a className="underline" href="/decks" title="Abre el constructor de mazos">
                        Mis mazos
                      </a>{' '}
                      ·{' '}
                      <a className="underline" href="/lobby" title="Vuelve al hangar para elegir otro mazo">
                        Elegir mazo
                      </a>
                    </span>
                  ) : loadout.ready ? (
                    <>
                      Mazo elegido:{' '}
                      <span className="text-[var(--color-signal)]">{loadout.deckName}</span>. Se baraja
                      en tu navegador; el rival solo verá cuántas cartas tienes.
                    </>
                  ) : null}
                </p>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <DeckActions
                  blocks={deckBlocks}
                  revealCount={revealCount}
                  onRevealCountChange={setRevealCount}
                  onDraw={() => canAct && actions.draw(1)}
                  onExtraDraw={() => !deckBlocks.extraDraw && actions.extraDraw()}
                  onReveal={startReveal}
                  onMill={millTop}
                  onRecycle={recycleTop}
                />
                <button
                  className="btn btn--sm"
                  type="button"
                  onClick={() => actions.shuffleDeck(deck.deck.length)}
                  disabled={!canAct}
                  title={canAct ? 'Baraja tu mazo (en tu navegador; el rival solo lo ve anotado)' : 'No disponible: sin conexión o partida cerrada.'}
                >
                  Barajar
                </button>
                <button
                  className="btn btn--sm"
                  type="button"
                  onClick={() => actions.rollDice(6)}
                  disabled={!canAct}
                  title={canAct ? 'Tira un dado de 6 caras; el resultado queda en el registro' : 'No disponible: sin conexión o partida cerrada.'}
                >
                  Dado d6
                </button>
                {opponent ? (
                  <button
                    className="btn btn--sm btn--ghost col-span-2"
                    type="button"
                    onClick={() => actions.concede(opponent.userId)}
                    disabled={!canAct}
                    title={canAct ? 'Te rindes: el rival gana la partida' : 'No disponible: sin conexión o partida cerrada.'}
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
                  title={
                    canAct
                      ? 'Vacía las zonas de los dos jugadores y vuelve al turno 1 (pide confirmación)'
                      : 'No disponible: sin conexión o partida cerrada.'
                  }
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
            playBlock={handPlayBlock}
            onActivateOrder={
              selection?.kind === 'hand' && canAct
                ? () => activateOrder(selection.card)
                : undefined
            }
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
        ) : null}
      </div>

      <Hand
        cards={deck.hand}
        selectedUid={selection?.kind === 'hand' ? selection.card.uid : undefined}
        onSelect={(card) => setSelection({ kind: 'hand', card })}
        pinned={handPinned}
        onTogglePin={() => setHandPinned((value) => !value)}
      />

      {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}

      {zoomCard && !viewerOpen && !discardOwner && !revealCards && !menu && !rulesOpen ? (
        <CardHoverZoom def={zoomCard.def} instance={zoomCard} />
      ) : null}

      {viewerOpen && selection ? (
        <CardViewerModal
          def={selection.kind === 'hand' ? selection.card.def : selection.card.def}
          instance={selection.kind === 'board' ? selection.card : undefined}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}

      {discardOwner === 'me' && me ? (
        <DiscardViewer
          cards={cardsInZone(me, 'void')}
          ownerLabel="Tú"
          actions={
            canAct
              ? {
                  onToHand: (card) => actions.returnToHand(card),
                  onToBattle:
                    firstEmptyBattleSlot(me) === undefined
                      ? undefined
                      : (card) =>
                          actions.moveCard({
                            uid: card.uid,
                            from: 'void',
                            to: 'battle',
                            slot: firstEmptyBattleSlot(me),
                          }),
                  onToResources: (card) =>
                    actions.moveCard({ uid: card.uid, from: 'void', to: 'resources' }),
                  onToDeck: (card, position) => actions.returnToDeck(card, position),
                }
              : undefined
          }
          onView={setVoidZoom}
          onClose={() => setDiscardOwner(null)}
        />
      ) : null}

      {discardOwner === 'opponent' && opponent ? (
        <DiscardViewer
          cards={cardsInZone(opponent, 'void')}
          ownerLabel={nameFor(opponent.userId)}
          onView={setVoidZoom}
          onClose={() => setDiscardOwner(null)}
        />
      ) : null}

      {voidZoom ? (
        <CardViewerModal def={voidZoom.def} instance={voidZoom} onClose={() => setVoidZoom(null)} />
      ) : null}

      {revealCards ? (
        <RevealModal
          cards={revealCards}
          onConfirm={confirmReveal}
          onCancel={() => setRevealCards(null)}
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
          onCharge={(value) => {
            actions.setCounter(menu.card.uid, CHARGE_COUNTER, Math.max(0, value));
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
