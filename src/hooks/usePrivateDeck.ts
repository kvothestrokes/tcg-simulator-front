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
import { GameEventType } from '../lib/game/events';
import type { CardDef } from '../lib/game/types';
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
  starterSize: number;
  /**
   * Aplica uno de TUS eventos ya persistidos. Ignora los del rival y los que ya
   * se hubieran aplicado antes.
   */
  applyOwnEvent: (event: WireEvent) => void;
  /** Borra el estado local (no declara nada). */
  forget: () => void;
}

export function usePrivateDeck(roomCode: string, userId: string | undefined): PrivateDeck {
  const storageKey = useMemo(
    () => (userId ? `cb:deck:${roomCode}:${userId}` : null),
    [roomCode, userId],
  );

  const [deck, setDeck] = useState<PrivateCard[]>([]);
  const [hand, setHand] = useState<PrivateCard[]>([]);

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
    setDeck(hydrate(stored?.deck ?? []));
    setHand(hydrate(stored?.hand ?? []));
    appliedSequence.current = stored?.appliedSequence ?? 0;
    dirty.current = false;
  }, [storageKey]);

  // Persistencia tras cada cambio.
  useEffect(() => {
    if (!storageKey || !dirty.current) return;
    writeStored(storageKey, {
      deck: deck.map((c) => ({ uid: c.uid, cardId: c.def.id })),
      hand: hand.map((c) => ({ uid: c.uid, cardId: c.def.id })),
      appliedSequence: appliedSequence.current,
    });
  }, [storageKey, deck, hand]);

  const applyOwnEvent = useCallback(
    (event: WireEvent) => {
      if (!userId || event.playerId !== userId) return;
      if (event.sequence <= appliedSequence.current) return;
      appliedSequence.current = event.sequence;
      dirty.current = true;

      const data = (event.data ?? {}) as Record<string, unknown>;

      switch (event.type) {
        case GameEventType.Setup: {
          setDeck(shuffleArray(buildDeck(buildStarterDeck())));
          setHand([]);
          break;
        }

        case GameEventType.Draw: {
          const count = Math.max(0, Number(data.count ?? 1));
          setDeck((current) => {
            const taken = current.slice(0, count);
            setHand((currentHand) => [...currentHand, ...taken]);
            return current.slice(taken.length);
          });
          break;
        }

        case GameEventType.Shuffle: {
          setDeck((current) => shuffleArray(current));
          break;
        }

        case GameEventType.Play: {
          const uid = String(data.uid ?? '');
          if (data.from === 'hand') {
            setHand((current) => removeCard(current, uid));
          } else if (data.from === 'deck') {
            setDeck((current) => removeCard(current, uid));
          }
          break;
        }

        case GameEventType.ToHand: {
          const card = cardFromEvent(data);
          if (card) setHand((current) => [...current, card]);
          break;
        }

        case GameEventType.ToDeck: {
          const card = cardFromEvent(data);
          if (!card) break;
          const position = String(data.position ?? 'shuffle');
          setDeck((current) => {
            if (position === 'top') return [card, ...current];
            if (position === 'bottom') return [...current, card];
            return shuffleArray([card, ...current]);
          });
          break;
        }

        case GameEventType.Reset: {
          setDeck([]);
          setHand([]);
          break;
        }

        default:
          break;
      }
    },
    [userId],
  );

  const forget = useCallback(() => {
    setDeck([]);
    setHand([]);
    appliedSequence.current = 0;
    dirty.current = false;
    if (storageKey) writeStored(storageKey, null);
  }, [storageKey]);

  return { deck, hand, starterSize: STARTER_SIZE, applyOwnEvent, forget };
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

/**
 * Quita una carta por uid. Si no está (por ejemplo, al reconstruir la partida
 * en otro dispositivo, donde el barajado fue distinto) quita la primera, para
 * que el contador siga cuadrando con lo que ve el rival.
 */
function removeCard(cards: PrivateCard[], uid: string): PrivateCard[] {
  const index = cards.findIndex((card) => card.uid === uid);
  if (index === -1) return cards.slice(1);
  return [...cards.slice(0, index), ...cards.slice(index + 1)];
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
