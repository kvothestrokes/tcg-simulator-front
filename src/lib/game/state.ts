/**
 * Motor de estado del juego.
 *
 * El tablero compartido NO se guarda en ningún sitio: es una función pura del
 * log de eventos. Como los dos clientes reciben exactamente los mismos eventos
 * en el mismo orden (lo garantiza la secuencia del backend), los dos llegan al
 * mismo tablero. Eso es lo que hace que reconectar, recargar la página o
 * reiniciar el servidor no pierdan la partida: basta con volver a reproducir.
 *
 * Lo único que NO se reconstruye desde aquí es tu mano y tu mazo, que son
 * información oculta y viven en local (ver hooks/usePrivateDeck.ts).
 */

import {
  GameEventType,
  REVEAL_ROUTES,
  ServerEventType,
  type ActivateOrderData,
  type AttackData,
  type CounterData,
  type DestroyData,
  type DiceData,
  type DrawData,
  type FlipData,
  type GameOverData,
  type HeatData,
  type LinkData,
  type MoveData,
  type PhaseData,
  type PlayData,
  type RemoveData,
  type ResourceData,
  type ResourceDrawData,
  type RevealData,
  type RevealResolveData,
  type SetupData,
  type ShuffleData,
  type TapData,
  type ToDeckData,
  type ToHandData,
  type TokenSpawnData,
  type TopCardData,
  type TurnStartData,
  type UnlinkData,
} from './events';
import {
  CARD_TYPE_LABEL,
  DAMAGE_COUNTER,
  emptyPlayer,
  emptyState,
  EXTRA_DRAW_HEAT,
  HEAT_COOLDOWN,
  HEAT_MAX,
  normalizePhase,
  PILOT_SLOTS,
  RESOURCE_MAX,
  SHARED_RESOURCE_DECK_SIZE,
  ZONE_LABEL,
  type CardDef,
  type CardInstance,
  type GameState,
  type LogEntry,
  type PlayerState,
  type ZoneId,
} from './types';
import { stationUid } from './cards';
import {
  attachedTo,
  canLinkTo,
  costBlock,
  damageOn,
  deckActionBlock,
  effectiveAttack,
  effectiveDefense,
  payCost,
  playPaysCost,
  recycleDestination,
  SHARED_RESOURCE_DEF,
  stationHp,
  TOKEN_DRONE_DEF,
} from './rules';
import type { WireEvent } from '../realtime/protocol';

const MAX_LOG_ENTRIES = 300;

/** Reproduce una lista de eventos desde cero. */
export function reduceAll(events: WireEvent[], base = emptyState()): GameState {
  return events.reduce((state, event) => applyEvent(state, event), base);
}

/**
 * Aplica un evento al estado. Es pura: devuelve un estado nuevo.
 *
 * Nunca lanza: un evento desconocido o mal formado se registra en el log y se
 * ignora. Un cliente de otra versión no debe poder romper la partida del rival.
 */
export function applyEvent(state: GameState, event: WireEvent): GameState {
  if (event.sequence <= state.lastSequence) return state;

  const next: GameState = { ...state, lastSequence: event.sequence };
  const data = (event.data ?? {}) as Record<string, unknown>;
  const actorId = event.playerId;

  // Rule checks run against the state BEFORE the event, the same one the
  // private deck uses to decide whether to move its cards (usePrivateDeck).
  const rejected = rejectionReason(state, event);
  if (rejected) {
    pushLog(next, event, `${name(actorId)} no pudo ${rejectedVerb(event.type, data)}: ${rejected}`);
    return next;
  }

  switch (event.type) {
    // --- eventos del servidor ------------------------------------------------
    case ServerEventType.PlayerJoined: {
      const userId = (data.userId as string) ?? actorId;
      if (!userId) break;
      const seat = ((data.seat as number) ?? event.seat ?? 1) as 1 | 2;
      withPlayer(next, userId, seat, (p) => ({ ...p, left: false }));
      pushLog(next, event, `${name(userId)} entró a la sala.`);
      break;
    }

    case ServerEventType.PlayerLeft: {
      const userId = (data.userId as string) ?? actorId;
      if (!userId) break;
      withPlayer(next, userId, (event.seat ?? 1) as 1 | 2, (p) => ({ ...p, left: true }));
      pushLog(next, event, `${name(userId)} abandonó la partida.`);
      break;
    }

    case ServerEventType.RoomStatus: {
      const status = data.status as GameState['status'];
      if (status) next.status = status;
      pushLog(next, event, `La partida pasó a «${status}».`);
      break;
    }

    case ServerEventType.Chat: {
      const message = String(data.message ?? '');
      pushLog(next, event, message, { message });
      break;
    }

    // --- eventos declarados por los jugadores --------------------------------
    case GameEventType.Setup: {
      const d = data as unknown as SetupData;
      if (!actorId) break;
      const deckCount = clamp(d.deckCount ?? 0, 0, 999);
      const opening = Math.min(deckCount, clamp(d.openingHand ?? 0, 0, 20));
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const cards: Record<string, CardInstance> = {};
        if (d.station) {
          const uid = stationUid(actorId);
          cards[uid] = {
            uid,
            def: d.station,
            ownerId: actorId,
            zone: 'station',
            faceUp: true,
            tapped: false,
            counters: {},
          };
        }
        return {
          ...p,
          deckCount: deckCount - opening,
          handCount: opening,
          cards,
          heat: 0,
          resourcePoints: 0,
          ready: true,
        };
      });
      const openingText = opening > 0 ? `, robó ${opening} carta${opening === 1 ? '' : 's'}` : '';
      pushLog(
        next,
        event,
        d.station
          ? `${name(actorId)} preparó su mazo (${deckCount} cartas)${openingText} y desplegó ${d.station.nombre}.`
          : `${name(actorId)} preparó su mazo (${deckCount} cartas)${openingText}.`,
      );
      break;
    }

    case GameEventType.Draw: {
      const d = data as unknown as DrawData;
      if (!actorId) break;
      const player = next.players[actorId];
      const wanted = clamp(d.count ?? 1, 1, 20);
      if (player && player.deckCount <= 0) {
        // Deck-out only loses from turn 2 on: on turn 1 the deck may simply
        // not be prepared yet.
        if (next.turn > 1) markGameOver(next, opponentId(next, actorId), 'deck_out', actorId);
        pushLog(next, event, `${name(actorId)} no pudo robar: mazo agotado.`);
        break;
      }
      const count = Math.min(wanted, player?.deckCount ?? wanted);
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        deckCount: Math.max(0, p.deckCount - count),
        handCount: p.handCount + count,
      }));
      pushLog(next, event, `${name(actorId)} robó ${count} carta${count === 1 ? '' : 's'}.`);
      break;
    }

    case GameEventType.Shuffle: {
      const d = data as unknown as ShuffleData;
      if (!actorId) break;
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        deckCount: clamp(d.deckCount ?? p.deckCount, 0, 999),
      }));
      pushLog(next, event, `${name(actorId)} barajó su mazo.`);
      break;
    }

    case GameEventType.Play: {
      const d = data as unknown as PlayData;
      if (!actorId || !d?.uid || !d?.def) break;
      const charged = Boolean(d.payCost) && playPaysCost(d);
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const card: CardInstance = {
          uid: d.uid,
          def: d.def,
          ownerId: actorId,
          zone: d.to,
          slot: d.slot,
          attachedTo: d.attachedTo,
          isToken: d.isToken,
          faceUp: d.faceUp ?? true,
          tapped: false,
          counters: {},
        };
        const paid = charged ? payCost(p, d.def) : p;
        return {
          ...paid,
          cards: { ...paid.cards, [d.uid]: card },
          handCount: d.from === 'hand' ? Math.max(0, p.handCount - 1) : p.handCount,
          deckCount: d.from === 'deck' ? Math.max(0, p.deckCount - 1) : p.deckCount,
        };
      });
      const costText = charged ? costSuffix(d.def) : '';
      pushLog(
        next,
        event,
        d.faceUp === false
          ? `${name(actorId)} colocó una carta boca abajo en ${ZONE_LABEL[d.to]}${costText}.`
          : `${name(actorId)} jugó ${d.def.nombre} (${CARD_TYPE_LABEL[d.def.tipo]}) en ${ZONE_LABEL[d.to]}${costText}.`,
      );
      break;
    }

    case GameEventType.ActivateOrder: {
      const d = data as unknown as ActivateOrderData;
      if (!actorId) break;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const paid = payCost(p, d.def);
        return {
          ...paid,
          cards: { ...paid.cards, [d.uid]: voidCard(d.uid, d.def, actorId) },
          handCount: Math.max(0, p.handCount - 1),
        };
      });
      pushLog(next, event, `${name(actorId)} activó la orden ${d.def.nombre}${costSuffix(d.def)}.`);
      break;
    }

    case GameEventType.ExtraDraw: {
      if (!actorId) break;
      const turn = next.turn;
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        deckCount: Math.max(0, p.deckCount - 1),
        handCount: p.handCount + 1,
        heat: Math.min(HEAT_MAX, p.heat + EXTRA_DRAW_HEAT),
        lastExtraDrawTurn: turn,
      }));
      pushLog(next, event, `${name(actorId)} hizo un Robo Extra (+${EXTRA_DRAW_HEAT} CC).`);
      break;
    }

    case GameEventType.Reveal: {
      const d = data as unknown as RevealData;
      const count = Number(d.count);
      pushLog(next, event, `${name(actorId)} revela ${count} carta${count === 1 ? '' : 's'} de su mazo.`);
      break;
    }

    case GameEventType.RevealResolve: {
      const d = data as unknown as RevealResolveData;
      if (!actorId) break;
      const tally = { hand: 0, top: 0, bottom: 0, void: 0 };
      for (const route of d.routes) tally[route] += 1;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const cards = { ...p.cards };
        for (const entry of d.voidCards) cards[entry.uid] = voidCard(entry.uid, entry.def, actorId);
        return {
          ...p,
          cards,
          deckCount: Math.max(0, p.deckCount - tally.hand - tally.void),
          handCount: p.handCount + tally.hand,
        };
      });
      const parts = [
        tally.hand ? `${tally.hand} a la mano` : '',
        tally.top ? `${tally.top} arriba del mazo` : '',
        tally.bottom ? `${tally.bottom} al fondo del mazo` : '',
        tally.void
          ? `${tally.void} al Vacío (${d.voidCards.map((entry) => entry.def.nombre).join(', ')})`
          : '',
      ].filter(Boolean);
      pushLog(next, event, `${name(actorId)} resolvió la revelación: ${parts.join(', ')}.`);
      break;
    }

    case GameEventType.Mill: {
      const d = data as unknown as TopCardData;
      if (!actorId) break;
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        cards: { ...p.cards, [d.uid]: voidCard(d.uid, d.def, actorId) },
        deckCount: Math.max(0, p.deckCount - 1),
      }));
      pushLog(next, event, `${name(actorId)} molió ${d.def.nombre} al Vacío.`);
      break;
    }

    case GameEventType.Recycle: {
      const d = data as unknown as TopCardData;
      if (!actorId) break;
      const zone = recycleDestination(d.def);
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        cards: {
          ...p.cards,
          // Enters untapped: a recycled Ship or Gear counts as a ready resource.
          [d.uid]: { ...voidCard(d.uid, d.def, actorId), zone },
        },
        deckCount: Math.max(0, p.deckCount - 1),
      }));
      pushLog(next, event, `${name(actorId)} recicló ${d.def.nombre} a ${ZONE_LABEL[zone]}.`);
      break;
    }

    case GameEventType.Move: {
      const d = data as unknown as MoveData;
      if (!actorId || !d?.uid) break;
      const owner = next.players[actorId];
      const existing = owner?.cards[d.uid];
      if (existing?.isToken && d.to !== 'battle') {
        applyRemove(next, actorId, d.uid);
        pushLog(next, event, `${name(actorId)} retiró el token ${cardName(existing)}.`);
        break;
      }
      if (existing && existing.def.tipo === 'Nave' && !existing.attachedTo && d.to === 'void') {
        applyDestroy(next, actorId, d.uid);
        pushLog(next, event, `${name(actorId)} destruyó ${cardName(existing)}.`);
        break;
      }
      let moved: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const card = p.cards[d.uid];
        if (!card) return p;
        moved = {
          ...card,
          zone: d.to,
          slot: d.slot,
          faceUp: d.faceUp ?? card.faceUp,
          attachedTo: d.attachedTo === undefined ? card.attachedTo : (d.attachedTo ?? undefined),
          tapped: d.to === 'battle' ? card.tapped : false,
          // Leaving the board clears counters; moving between board zones keeps them.
          counters: d.to === 'void' ? {} : card.counters,
        };
        const cards = { ...p.cards, [d.uid]: moved };
        if (card.def.tipo === 'Nave' && !card.attachedTo && d.to === 'battle') {
          for (const child of attachedTo(p, card.uid)) {
            cards[child.uid] = { ...child, zone: 'battle', slot: d.slot };
          }
        }
        return { ...p, cards };
      });
      if (moved) {
        pushLog(
          next,
          event,
          `${name(actorId)} movió ${cardName(moved)} a ${ZONE_LABEL[d.to]}.`,
        );
      }
      break;
    }

    case GameEventType.ToHand: {
      const d = data as unknown as ToHandData;
      if (!actorId || !d?.uid) break;
      const existing = next.players[actorId]?.cards[d.uid];
      if (existing?.isToken) {
        applyRemove(next, actorId, d.uid);
        pushLog(next, event, `${name(actorId)} retiró el token ${cardName(existing)}.`);
        break;
      }
      let removed: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        removed = p.cards[d.uid];
        if (!removed) return p;
        const cards = { ...p.cards };
        delete cards[d.uid];
        for (const child of attachedTo(p, d.uid)) {
          cards[child.uid] = { ...child, attachedTo: undefined };
        }
        return { ...p, cards, handCount: p.handCount + 1 };
      });
      if (removed) pushLog(next, event, `${name(actorId)} devolvió ${cardName(removed)} a su mano.`);
      break;
    }

    case GameEventType.ToDeck: {
      const d = data as unknown as ToDeckData;
      if (!actorId || !d?.uid) break;
      const existing = next.players[actorId]?.cards[d.uid];
      if (existing?.isToken) {
        applyRemove(next, actorId, d.uid);
        pushLog(next, event, `${name(actorId)} retiró el token ${cardName(existing)}.`);
        break;
      }
      let removed: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        removed = p.cards[d.uid];
        if (!removed) return p;
        const cards = { ...p.cards };
        delete cards[d.uid];
        for (const child of attachedTo(p, d.uid)) {
          cards[child.uid] = { ...child, attachedTo: undefined };
        }
        return { ...p, cards, deckCount: p.deckCount + 1 };
      });
      if (removed) pushLog(next, event, `${name(actorId)} devolvió ${cardName(removed)} al mazo.`);
      break;
    }

    case GameEventType.Tap: {
      const d = data as unknown as TapData;
      if (!actorId || !d?.uid) break;
      let card: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const current = p.cards[d.uid];
        if (!current) return p;
        card = { ...current, tapped: Boolean(d.tapped) };
        return { ...p, cards: { ...p.cards, [d.uid]: card } };
      });
      if (card) {
        pushLog(next, event, `${name(actorId)} ${d.tapped ? 'giró' : 'enderezó'} ${cardName(card)}.`);
      }
      break;
    }

    case GameEventType.Flip: {
      const d = data as unknown as FlipData;
      if (!actorId || !d?.uid) break;
      let card: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const current = p.cards[d.uid];
        if (!current) return p;
        card = { ...current, faceUp: Boolean(d.faceUp) };
        return { ...p, cards: { ...p.cards, [d.uid]: card } };
      });
      if (card) {
        pushLog(
          next,
          event,
          `${name(actorId)} puso ${cardName(card)} boca ${d.faceUp ? 'arriba' : 'abajo'}.`,
        );
      }
      break;
    }

    case GameEventType.Counter: {
      const d = data as unknown as CounterData;
      if (!actorId || !d?.uid) break;
      let card: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const current = p.cards[d.uid];
        if (!current) return p;
        const counters = { ...current.counters };
        const value = clamp(d.value ?? 0, -99, 99);
        if (value === 0) delete counters[d.key];
        else counters[d.key] = value;
        card = { ...current, counters };
        return { ...p, cards: { ...p.cards, [d.uid]: card } };
      });
      if (card) {
        pushLog(next, event, `${name(actorId)} dejó ${cardName(card)} con ${d.key} ${d.value}.`);
      }
      break;
    }

    case GameEventType.Heat: {
      const d = data as unknown as HeatData;
      if (!actorId) break;
      const value = clamp(d.value ?? 0, 0, HEAT_MAX);
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({ ...p, heat: value }));
      pushLog(next, event, `${name(actorId)} fijó su calor en ${value}.`);
      break;
    }

    case GameEventType.Resource: {
      const d = data as unknown as ResourceData;
      if (!actorId) break;
      const value = clamp(d.value ?? 0, 0, RESOURCE_MAX);
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({ ...p, resourcePoints: value }));
      pushLog(next, event, `${name(actorId)} fijó sus puntos de recurso en ${value}.`);
      break;
    }

    case GameEventType.Phase: {
      const d = data as unknown as PhaseData;
      const phase = normalizePhase(d.phase);
      next.phase = phase;
      next.turn = clamp(d.turn ?? next.turn, 1, 999);
      next.activePlayerId = d.activePlayerId ?? next.activePlayerId;
      if (phase === 'Activación' && next.activePlayerId) {
        withPlayer(next, next.activePlayerId, event.seat ?? 1, untapPlayer);
      }
      pushLog(
        next,
        event,
        `Turno ${next.turn} · ${next.phase}${
          next.activePlayerId ? ` · juega ${name(next.activePlayerId)}` : ''
        }.`,
      );
      break;
    }

    case GameEventType.TurnStart: {
      const d = data as unknown as TurnStartData;
      const activeId = d.activePlayerId ?? actorId;
      if (!activeId) break;
      next.phase = 'Inicial';
      next.turn = clamp(d.turn ?? next.turn, 1, 999);
      next.activePlayerId = activeId;
      const player = next.players[activeId];
      // Deck-out only loses from turn 2 on: on turn 1 the deck may simply not
      // be prepared yet (the old instant-loss bug).
      if (player && player.deckCount <= 0 && next.turn > 1) {
        markGameOver(next, opponentId(next, activeId), 'deck_out', activeId);
        pushLog(next, event, `${name(activeId)} pierde: no quedan cartas en el mazo.`);
        break;
      }
      // Refresco atómico al entrar en Inicial: se endereza todo, se roba y se
      // enfría, para que el jugador que empieza su turno vea todo listo de una.
      const draws = (player?.deckCount ?? 0) > 0 ? 1 : 0;
      withPlayer(next, activeId, event.seat ?? 1, (p) => ({
        ...untapPlayer(p),
        deckCount: Math.max(0, p.deckCount - draws),
        handCount: p.handCount + draws,
        heat: Math.max(0, p.heat - HEAT_COOLDOWN),
      }));
      const gotResource =
        Boolean(d.autoResource && d.resourceUid) &&
        grantSharedResource(next, activeId, d.resourceUid!, event.seat ?? 1);
      const steps = [
        'endereza',
        draws ? 'roba' : 'sin cartas que robar',
        `−${HEAT_COOLDOWN} CC`,
        gotResource ? '+1 recurso' : '',
      ].filter(Boolean);
      pushLog(
        next,
        event,
        `Turno ${next.turn} · Inicial · juega ${name(activeId)} (${steps.join(', ')}).`,
      );
      break;
    }

    case GameEventType.ResourceDraw: {
      const d = data as unknown as ResourceDrawData;
      if (!actorId || !d?.uid) break;
      if (next.sharedResourceDeckCount <= 0) {
        pushLog(next, event, `${name(actorId)} no pudo robar recurso: mazo compartido agotado.`);
        break;
      }
      if (!grantSharedResource(next, actorId, d.uid, event.seat ?? 1)) {
        pushLog(next, event, `${name(actorId)} ya robó un recurso este turno.`);
        break;
      }
      pushLog(next, event, `${name(actorId)} robó un recurso del mazo compartido.`);
      break;
    }

    case GameEventType.Link: {
      const d = data as unknown as LinkData;
      if (!actorId || !d?.childUid || !d?.parentUid) break;
      const player = next.players[actorId];
      const parent = player?.cards[d.parentUid];
      const child = player?.cards[d.childUid];
      if (!player || !parent || !child || !canLinkTo(player, parent, child)) {
        pushLog(next, event, `${name(actorId)} no pudo enlazar cartas.`);
        break;
      }
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        cards: {
          ...p.cards,
          [d.childUid]: {
            ...child,
            attachedTo: parent.uid,
            zone: 'battle',
            slot: parent.slot,
          },
        },
      }));
      pushLog(
        next,
        event,
        `${name(actorId)} enlazó ${cardName(child)} a ${cardName(parent)}.`,
      );
      break;
    }

    case GameEventType.Unlink: {
      const d = data as unknown as UnlinkData;
      if (!actorId || !d?.childUid) break;
      const child = next.players[actorId]?.cards[d.childUid];
      if (!child) break;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const zone: ZoneId = child.def.tipo === 'Piloto' ? 'pilots' : 'resources';
        const slot = zone === 'pilots' ? firstEmptyPilotSlot(p) : undefined;
        return {
          ...p,
          cards: {
            ...p.cards,
            [d.childUid]: { ...child, attachedTo: undefined, zone, slot, tapped: false },
          },
        };
      });
      pushLog(next, event, `${name(actorId)} desenganchó ${cardName(child)}.`);
      break;
    }

    case GameEventType.Attack: {
      const d = data as unknown as AttackData;
      if (!actorId || !d?.sourceUid || !d?.targetUid || !d?.targetOwnerId) break;
      const attackerOwner = next.players[actorId];
      const defenderOwner = next.players[d.targetOwnerId];
      const source = attackerOwner?.cards[d.sourceUid];
      const target = defenderOwner?.cards[d.targetUid];
      if (!attackerOwner || !defenderOwner || !source || !target) {
        pushLog(next, event, `${name(actorId)} declaró un ataque inválido.`);
        break;
      }
      const amount = effectiveAttack(attackerOwner, source);
      const nextDamage = damageOn(target) + amount;
      withPlayer(next, d.targetOwnerId, defenderOwner.seat, (p) => ({
        ...p,
        cards: {
          ...p.cards,
          [d.targetUid]: {
            ...target,
            counters: { ...target.counters, [DAMAGE_COUNTER]: nextDamage },
          },
        },
      }));
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const current = p.cards[d.sourceUid];
        if (!current) return p;
        return { ...p, cards: { ...p.cards, [d.sourceUid]: { ...current, tapped: true } } };
      });
      pushLog(
        next,
        event,
        `${name(actorId)} atacó ${cardName(target)} con ${cardName(source)} (${amount} ATK).`,
      );

      if (target.def.tipo === 'Estación') {
        if (nextDamage >= stationHp(target)) {
          markGameOver(next, actorId, 'station', d.targetOwnerId);
          pushLog(next, event, `${name(actorId)} destruyó la estación enemiga.`);
        }
      } else if (nextDamage >= effectiveDefense(defenderOwner, target)) {
        applyDestroy(next, d.targetOwnerId, d.targetUid);
        pushLog(next, event, `${cardName(target)} fue destruida.`);
      }
      break;
    }

    case GameEventType.Destroy: {
      const d = data as unknown as DestroyData;
      if (!actorId || !d?.uid) break;
      const card = next.players[actorId]?.cards[d.uid];
      if (!card) break;
      applyDestroy(next, actorId, d.uid);
      pushLog(next, event, `${name(actorId)} destruyó ${cardName(card)}.`);
      break;
    }

    case GameEventType.TokenSpawn: {
      const d = data as unknown as TokenSpawnData;
      if (!actorId || !d?.uid) break;
      const def = d.def ?? TOKEN_DRONE_DEF;
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        cards: {
          ...p.cards,
          [d.uid]: {
            uid: d.uid,
            def,
            ownerId: actorId,
            zone: 'battle',
            slot: d.slot,
            isToken: true,
            faceUp: true,
            tapped: false,
            counters: {},
          },
        },
      }));
      pushLog(next, event, `${name(actorId)} desplegó el token ${def.nombre}.`);
      break;
    }

    case GameEventType.Remove: {
      const d = data as unknown as RemoveData;
      if (!actorId || !d?.uid) break;
      const card = next.players[actorId]?.cards[d.uid];
      applyRemove(next, actorId, d.uid);
      if (card) pushLog(next, event, `${name(actorId)} retiró ${cardName(card)} de la partida.`);
      break;
    }

    case GameEventType.GameOver: {
      const d = data as unknown as GameOverData;
      if (!d?.winnerId) break;
      markGameOver(next, d.winnerId, d.reason ?? 'concede', d.loserId);
      pushLog(next, event, `${name(d.winnerId)} gana (${d.reason ?? 'concede'}).`);
      break;
    }

    case GameEventType.Dice: {
      const d = data as unknown as DiceData;
      pushLog(
        next,
        event,
        `${name(actorId)} tiró 1d${d.sides ?? 6} y sacó ${d.result ?? '?'}.`,
      );
      break;
    }

    case GameEventType.Reset: {
      const players: Record<string, PlayerState> = {};
      for (const [id, p] of Object.entries(next.players)) {
        players[id] = { ...emptyPlayer(id, p.seat), connected: p.connected, left: p.left };
      }
      next.players = players;
      next.turn = 1;
      next.phase = 'Inicial';
      next.activePlayerId = undefined;
      next.sharedResourceDeckCount = SHARED_RESOURCE_DECK_SIZE;
      next.winnerId = undefined;
      next.endReason = undefined;
      next.status = next.status === 'finished' ? 'active' : next.status;
      pushLog(next, event, `${name(actorId)} reinició la mesa.`);
      break;
    }

    default:
      // Evento de una versión más nueva del cliente: se anota y se sigue.
      pushLog(next, event, `${name(actorId)} declaró ${event.type}.`);
      break;
  }

  return next;
}

// --- utilidades --------------------------------------------------------------

/** Aplica una transformación al jugador, creándolo si aún no existía. */
function withPlayer(
  state: GameState,
  userId: string,
  seat: 1 | 2,
  update: (player: PlayerState) => PlayerState,
): void {
  const current = state.players[userId] ?? emptyPlayer(userId, seat);
  state.players = { ...state.players, [userId]: update(current) };
}

function untapPlayer(player: PlayerState): PlayerState {
  const cards: Record<string, CardInstance> = {};
  for (const [uid, card] of Object.entries(player.cards)) {
    cards[uid] = card.tapped ? { ...card, tapped: false } : card;
  }
  return { ...player, cards };
}

function firstEmptyPilotSlot(player: PlayerState): number {
  const taken = new Set(
    Object.values(player.cards)
      .filter((card) => card.zone === 'pilots' && card.slot !== undefined)
      .map((card) => card.slot),
  );
  for (let slot = 0; slot < PILOT_SLOTS; slot++) {
    if (!taken.has(slot)) return slot;
  }
  return PILOT_SLOTS;
}

function applyRemove(state: GameState, ownerId: string, uid: string): void {
  const owner = state.players[ownerId];
  if (!owner) return;
  withPlayer(state, ownerId, owner.seat, (p) => {
    const cards = { ...p.cards };
    delete cards[uid];
    for (const child of attachedTo(p, uid)) {
      delete cards[child.uid];
    }
    return { ...p, cards };
  });
}

function applyDestroy(state: GameState, ownerId: string, uid: string): void {
  const owner = state.players[ownerId];
  const ship = owner?.cards[uid];
  if (!owner || !ship) return;
  if (ship.isToken) {
    applyRemove(state, ownerId, uid);
    return;
  }
  withPlayer(state, ownerId, owner.seat, (p) => {
    const cards = { ...p.cards };
    for (const child of attachedTo(p, uid)) {
      if (child.def.tipo === 'Piloto') {
        cards[child.uid] = {
          ...child,
          attachedTo: undefined,
          zone: 'pilots',
          slot: firstEmptyPilotSlot({ ...p, cards }),
          tapped: false,
        };
      } else {
        cards[child.uid] = {
          ...child,
          attachedTo: undefined,
          zone: 'resources',
          slot: undefined,
          tapped: false,
        };
      }
    }
    cards[uid] = {
      ...ship,
      zone: 'void',
      attachedTo: undefined,
      slot: undefined,
      tapped: false,
      counters: {},
    };
    return { ...p, cards };
  });
}

/**
 * Moves one card from the shared resource deck to the player's resources zone,
 * honouring the 1-per-turn rule. Returns false when nothing was drawn.
 */
function grantSharedResource(state: GameState, playerId: string, uid: string, seat: 1 | 2): boolean {
  if (state.sharedResourceDeckCount <= 0) return false;
  if (state.players[playerId]?.lastResourceDrawTurn === state.turn) return false;
  const turn = state.turn;
  state.sharedResourceDeckCount -= 1;
  withPlayer(state, playerId, seat, (p) => ({
    ...p,
    cards: {
      ...p.cards,
      [uid]: {
        uid,
        def: SHARED_RESOURCE_DEF,
        ownerId: playerId,
        zone: 'resources',
        faceUp: true,
        tapped: false,
        counters: {},
      },
    },
    resourcePoints: p.resourcePoints + 1,
    lastResourceDrawTurn: turn,
  }));
  return true;
}

/** A card that just became public in the void. */
function voidCard(uid: string, def: CardDef, ownerId: string): CardInstance {
  return { uid, def, ownerId, zone: 'void', faceUp: true, tapped: false, counters: {} };
}

function costSuffix(def: CardDef): string {
  const resources = Math.max(0, def.coste_recursos ?? 0);
  const heat = Math.max(0, def.coste_heat ?? 0);
  const parts = [
    resources ? `paga ${resources} recurso${resources === 1 ? '' : 's'}` : '',
    heat ? `+${heat} CC` : '',
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

/**
 * Why `event` breaks a rule given the state right before it, or null when it is
 * accepted. Pure and shared: the reducer ignores rejected events, and the
 * private deck (usePrivateDeck) skips them too, so the hidden hand never moves
 * a card the shared board refused.
 */
export function rejectionReason(state: GameState, event: WireEvent): string | null {
  const actorId = event.playerId;
  const data = (event.data ?? {}) as Record<string, unknown>;
  switch (event.type) {
    case GameEventType.Play: {
      const d = data as unknown as PlayData;
      if (!actorId || !d?.def || !d.payCost || !playPaysCost(d)) return null;
      return costBlock(state.players[actorId], d.def);
    }
    case GameEventType.ActivateOrder: {
      const d = data as unknown as ActivateOrderData;
      if (!actorId || !d?.uid || !d?.def) return 'falta la carta.';
      if (d.def.tipo !== 'Orden') return `${d.def.nombre} no es una orden.`;
      return costBlock(state.players[actorId], d.def);
    }
    case GameEventType.ExtraDraw:
      return deckActionBlock(state, actorId, 'extraDraw');
    case GameEventType.Reveal:
      return deckActionBlock(state, actorId, 'reveal', Number((data as unknown as RevealData).count));
    case GameEventType.RevealResolve: {
      const d = data as unknown as RevealResolveData;
      const count = Number(d.count);
      const block = deckActionBlock(state, actorId, 'reveal', count);
      if (block) return block;
      if (!Array.isArray(d.routes) || d.routes.length !== count) {
        return 'los destinos no cuadran con las cartas reveladas.';
      }
      if (d.routes.some((route) => !REVEAL_ROUTES.includes(route))) return 'destino de carta inválido.';
      const voidCards = Array.isArray(d.voidCards) ? d.voidCards : [];
      const voidIndexes = d.routes.flatMap((route, index) => (route === 'void' ? [index] : []));
      const complete =
        voidCards.length === voidIndexes.length &&
        voidIndexes.every((index) =>
          voidCards.some((entry) => entry?.index === index && entry.uid && entry.def),
        );
      return complete ? null : 'faltan las cartas que van al Vacío.';
    }
    case GameEventType.Mill:
    case GameEventType.Recycle: {
      const d = data as unknown as TopCardData;
      if (!d?.uid || !d?.def) return 'falta la carta superior del mazo.';
      return deckActionBlock(state, actorId, event.type === GameEventType.Mill ? 'mill' : 'recycle');
    }
    default:
      return null;
  }
}

function rejectedVerb(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case GameEventType.Play: {
      const def = data.def as CardDef | undefined;
      return def?.nombre ? `jugar ${def.nombre}` : 'jugar la carta';
    }
    case GameEventType.ActivateOrder:
      return 'activar la orden';
    case GameEventType.ExtraDraw:
      return 'hacer Robo Extra';
    case GameEventType.Reveal:
    case GameEventType.RevealResolve:
      return 'revelar cartas';
    case GameEventType.Mill:
      return 'moler';
    case GameEventType.Recycle:
      return 'reciclar';
    default:
      return 'actuar';
  }
}

function markGameOver(
  state: GameState,
  winnerId: string | undefined,
  reason: NonNullable<GameState['endReason']>,
  _loserId?: string,
): void {
  state.status = 'finished';
  state.winnerId = winnerId;
  state.endReason = reason;
}

function opponentId(state: GameState, userId: string): string | undefined {
  return Object.keys(state.players).find((id) => id !== userId);
}

function pushLog(
  state: GameState,
  event: WireEvent,
  text: string,
  chat?: LogEntry['chat'],
): void {
  const entry: LogEntry = {
    sequence: event.sequence,
    playerId: event.playerId,
    type: event.type,
    text,
    at: event.createdAt,
    chat,
  };
  const log = [...state.log, entry];
  state.log = log.length > MAX_LOG_ENTRIES ? log.slice(log.length - MAX_LOG_ENTRIES) : log;
}

function cardName(card: CardInstance): string {
  return card.faceUp ? card.def.nombre : 'una carta boca abajo';
}

/** Nombre corto y estable a partir del id; la UI lo sustituye por el real. */
function name(userId?: string): string {
  if (!userId) return 'El sistema';
  return `Piloto-${userId.slice(0, 4).toUpperCase()}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Presencia en vivo: no viene del log, se aplica encima. */
export function applyPresence(
  state: GameState,
  userId: string,
  seat: 1 | 2,
  connected: boolean,
): GameState {
  const next = { ...state };
  withPlayer(next, userId, seat, (p) => ({ ...p, connected }));
  return next;
}

/** Siembra los jugadores conocidos por el servidor al entrar en la sala. */
export function seedPlayers(
  state: GameState,
  roster: { userId: string; seat: 1 | 2; connected: boolean; leftAt?: string }[],
): GameState {
  const next = { ...state };
  for (const entry of roster) {
    withPlayer(next, entry.userId, entry.seat, (p) => ({
      ...p,
      seat: entry.seat,
      connected: entry.connected,
      left: Boolean(entry.leftAt),
    }));
  }
  return next;
}

export function zoneCount(player: PlayerState | undefined, zone: ZoneId): number {
  if (!player) return 0;
  if (zone === 'deck') return player.deckCount;
  if (zone === 'hand') return player.handCount;
  return Object.values(player.cards).filter((card) => card.zone === zone).length;
}
