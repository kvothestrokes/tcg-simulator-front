/**
 * Mazo y mano: la única información oculta del simulador.
 *
 * Viven en local (nunca viajan al rival) y se guardan en localStorage por sala
 * y jugador, así que un F5 no te hace perder la mano.
 *
 * La pieza clave es `applyOwnEvent`: las cartas privadas NO se mueven cuando
 * pulsas un botón, sino cuando el evento correspondiente vuelve del servidor ya
 * persistido. Así la mano nunca se adelanta al tablero compartido, y si una
 * acción se rechaza (sala cerrada, límite de frecuencia) no pierdes la carta.
 *
 * Para que reproducir el historial no vuelva a robar las mismas cartas, se
 * guarda hasta qué secuencia se aplicó ya. Si abres la partida en otro
 * dispositivo, el historial se reproduce entero y se reconstruye una mano
 * *distinta pero del mismo tamaño*: el contenido exacto es irrecuperable por
 * definición, porque nunca salió de tu navegador.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildStarterDeck, findCard } from '../lib/game/cards';
import { drawTop, removeByUid, routeRevealed, type Piles } from '../lib/game/deckOps';
import { GameEventType, type RevealRoute } from '../lib/game/events';
import { rejectionReason } from '../lib/game/state';
import type { CardDef, GameState } from '../lib/game/types';
import { randomUuid } from '../lib/realtime/client';
import type { WireEvent } from '../lib/realtime/protocol';

export interface PrivateCard {
  uid: string;
  def: CardDef;
}

interface StoredDeck {
  deck: { uid: string; cardId: string }[];
  hand: { uid: string; cardId: string }[];
  appliedSequence: number;
}

export interface PrivateDeck {
  deck: PrivateCard[];
  hand: PrivateCard[];
  /** Tamaño del mazo que se declarará al preparar la partida. */
  deckSize: number;
  /**
   * Aplica uno de TUS eventos ya persistidos (y el TURN_START que te da el
   * turno, lo declare quien lo declare). Ignora los del rival, los que ya se
   * aplicaron y los que el reducer rechaza según `before`.
   */
  applyOwnEvent: (event: WireEvent, before?: GameState) => void;
  /** Borra el estado local (no declara nada). */
  forget: () => void;
}

const EMPTY_PILES: Piles<PrivateCard> = { deck: [], hand: [] };

/**
 * @param loadoutCardIds  Cartas del mazo elegido (ids repetidos por copia, sin la
 *   estación). Si viene vacío se usa el mazo de ejemplo como respaldo.
 */
export function usePrivateDeck(
  roomCode: string,
  userId: string | undefined,
  loadoutCardIds: string[] = [],
): PrivateDeck {
  const storageKey = useMemo(
    () => (userId ? `cb:deck:${roomCode}:${userId}` : null),
    [roomCode, userId],
  );

  // Deck and hand live in ONE state object so every move is a single pure update.
  const [piles, setPiles] = useState<Piles<PrivateCard>>(EMPTY_PILES);

  // La lista de cartas elegida se consulta dentro del manejador de SETUP, que es
  // síncrono; por eso se guarda en una ref además de la prop.
  const loadoutRef = useRef<string[]>(loadoutCardIds);
  useEffect(() => {
    loadoutRef.current = loadoutCardIds;
  }, [loadoutCardIds]);

  // La secuencia aplicada se lleva en una ref: se consulta dentro del manejador
  // de eventos, donde no se puede depender de que React haya re-renderizado.
  const appliedSequence = useRef(0);
  const loadedKey = useRef<string | null>(null);
  const dirty = useRef(false);

  // Rehidratación al montar o al cambiar de sala.
  useEffect(() => {
    if (!storageKey || loadedKey.current === storageKey) return;
    loadedKey.current = storageKey;

    const stored = readStored(storageKey);
    setPiles({ deck: hydrate(stored?.deck ?? []), hand: hydrate(stored?.hand ?? []) });
    appliedSequence.current = stored?.appliedSequence ?? 0;
    dirty.current = false;
  }, [storageKey]);

  // Persistencia tras cada cambio.
  useEffect(() => {
    if (!storageKey || !dirty.current) return;
    writeStored(storageKey, {
      deck: piles.deck.map((c) => ({ uid: c.uid, cardId: c.def.id })),
      hand: piles.hand.map((c) => ({ uid: c.uid, cardId: c.def.id })),
      appliedSequence: appliedSequence.current,
    });
  }, [storageKey, piles]);

  const applyOwnEvent = useCallback(
    (event: WireEvent, before?: GameState) => {
      if (!userId) return;
      const data = (event.data ?? {}) as Record<string, unknown>;
      // The opponent declares the TURN_START that hands you the turn, and that
      // turn's draw comes from YOUR deck.
      // Same fallback as the reducer: a TURN_START without activePlayerId is the actor's.
      const turnForMe =
        event.type === GameEventType.TurnStart &&
        (data.activePlayerId ?? event.playerId) === userId;
      if (event.playerId !== userId && !turnForMe) return;
      if (event.sequence <= appliedSequence.current) return;
      appliedSequence.current = event.sequence;
      dirty.current = true;

      // The shared board ignored it, so the hidden cards must not move either.
      if (before && rejectionReason(before, event)) return;

      switch (event.type) {
        case GameEventType.Setup: {
          const chosen = loadoutRef.current;
          const ids = chosen.length > 0 ? chosen : buildStarterDeck();
          const deck = shuffleArray(buildDeck(ids));
          const opening = Math.max(0, Math.min(20, Math.round(Number(data.openingHand ?? 0)) || 0));
          setPiles(drawTop({ deck, hand: [] }, opening));
          break;
        }

        case GameEventType.Draw: {
          const count = Math.max(0, Number(data.count ?? 1));
          setPiles((current) => drawTop(current, count));
          break;
        }

        case GameEventType.TurnStart: {
          // Passing the turn to the opponent is your event too, but not your draw.
          if (turnForMe) setPiles((current) => drawTop(current, 1));
          break;
        }

        case GameEventType.ExtraDraw: {
          setPiles((current) => drawTop(current, 1));
          break;
        }

        case GameEventType.Shuffle: {
          setPiles((current) => ({ ...current, deck: shuffleArray(current.deck) }));
          break;
        }

        case GameEventType.Play: {
          const uid = String(data.uid ?? '');
          if (data.from === 'hand') {
            setPiles((current) => ({ ...current, hand: removeByUid(current.hand, uid) }));
          } else if (data.from === 'deck') {
            setPiles((current) => ({ ...current, deck: removeByUid(current.deck, uid) }));
          }
          break;
        }

        case GameEventType.ActivateOrder: {
          const uid = String(data.uid ?? '');
          setPiles((current) => ({ ...current, hand: removeByUid(current.hand, uid) }));
          break;
        }

        case GameEventType.RevealResolve: {
          const routes = (Array.isArray(data.routes) ? data.routes : []) as RevealRoute[];
          // Void cards are public now: the reducer put them on the board.
          setPiles((current) => {
            const { deck, hand } = routeRevealed(current, routes);
            return { deck, hand };
          });
          break;
        }

        case GameEventType.Mill:
        case GameEventType.Recycle: {
          const uid = String(data.uid ?? '');
          setPiles((current) => ({ ...current, deck: removeByUid(current.deck, uid) }));
          break;
        }

        case GameEventType.ToHand: {
          const card = cardFromEvent(data);
          if (card) setPiles((current) => ({ ...current, hand: [...current.hand, card] }));
          break;
        }

        case GameEventType.ToDeck: {
          const card = cardFromEvent(data);
          if (!card) break;
          const position = String(data.position ?? 'shuffle');
          setPiles((current) => {
            if (position === 'top') return { ...current, deck: [card, ...current.deck] };
            if (position === 'bottom') return { ...current, deck: [...current.deck, card] };
            return { ...current, deck: shuffleArray([card, ...current.deck]) };
          });
          break;
        }

        case GameEventType.Reset: {
          setPiles(EMPTY_PILES);
          break;
        }

        default:
          break;
      }
    },
    [userId],
  );

  const forget = useCallback(() => {
    setPiles(EMPTY_PILES);
    appliedSequence.current = 0;
    dirty.current = false;
    if (storageKey) writeStored(storageKey, null);
  }, [storageKey]);

  const deckSize = loadoutCardIds.length > 0 ? loadoutCardIds.length : STARTER_SIZE;

  return { deck: piles.deck, hand: piles.hand, deckSize, applyOwnEvent, forget };
}

const STARTER_SIZE = buildStarterDeck().length;

// --- utilidades --------------------------------------------------------------

function buildDeck(cardIds: string[]): PrivateCard[] {
  const cards: PrivateCard[] = [];
  for (const id of cardIds) {
    const def = findCard(id);
    if (def) cards.push({ uid: randomUuid(), def });
  }
  return cards;
}

function cardFromEvent(data: Record<string, unknown>): PrivateCard | null {
  const uid = String(data.uid ?? '');
  const def = data.def as CardDef | undefined;
  if (!uid) return null;
  if (def?.id) return { uid, def };
  const cardId = String(data.cardId ?? '');
  const found = findCard(cardId);
  return found ? { uid, def: found } : null;
}

/** Fisher-Yates. No hace falta semilla: el mazo es privado. */
function shuffleArray<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function hydrate(entries: { uid: string; cardId: string }[]): PrivateCard[] {
  const out: PrivateCard[] = [];
  for (const entry of entries) {
    const def = findCard(entry.cardId);
    if (def) out.push({ uid: entry.uid, def });
  }
  return out;
}

function readStored(key: string): StoredDeck | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDeck;
    if (!Array.isArray(parsed?.deck) || !Array.isArray(parsed?.hand)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredDeck | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento, el mazo dura lo que dure la pestaña.
  }
}
