/**
 * useSelectedLoadout — resolves the player's chosen deck into the cards they will
 * actually play with in a match.
 *
 * It reads the selected deck id (see lib/decks/selectedDeck), loads that deck's
 * rows, and expands them by quantity into a flat list of non-station card ids
 * plus the single station def. usePrivateDeck consumes this on SETUP so the deck
 * you built is the deck you draw from — never the hardcoded starter.
 *
 * When Supabase is disabled or no deck is selected, `ready` is false and the
 * caller falls back to the starter deck.
 */

import { useEffect, useMemo, useState } from 'react';

import type { CardDef } from '@/lib/game/types';
import { findCard, hydrateCatalog, publicCardDef } from '@/lib/game/cards';
import { isStation } from '@/lib/decks/validation';
import { getSelectedDeckId } from '@/lib/decks/selectedDeck';
import { SUPABASE_ENABLED } from '@/lib/config';
import { supabase } from '@/lib/session';

export interface Loadout {
  deckId: string | null;
  deckName: string | null;
  /** Non-station card ids, expanded by quantity — one entry per physical card. */
  cardIds: string[];
  /** The deck's single space station, if it defines one. */
  station: CardDef | null;
  loading: boolean;
  /** True when a deck was resolved into a non-empty loadout. */
  ready: boolean;
}

const EMPTY: Loadout = {
  deckId: null,
  deckName: null,
  cardIds: [],
  station: null,
  loading: false,
  ready: false,
};

export function useSelectedLoadout(userId: string | undefined): Loadout {
  const deckId = useMemo(() => getSelectedDeckId(userId), [userId]);
  const [loadout, setLoadout] = useState<Loadout>(EMPTY);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !deckId) {
      setLoadout({ ...EMPTY, deckId: deckId ?? null });
      return;
    }

    let active = true;
    setLoadout({ ...EMPTY, deckId, loading: true });

    void (async () => {
      // Make sure findCard() resolves DB-backed cards, not just the fallback.
      await hydrateCatalog();
      try {
        const client = await supabase();

        const [{ data: deckRow }, { data: cardRows }] = await Promise.all([
          client.from('decks').select('nombre').eq('id', deckId).single(),
          client.from('deck_cards').select('card_id, qty').eq('deck_id', deckId),
        ]);

        if (!active) return;

        const cardIds: string[] = [];
        let station: CardDef | null = null;

        for (const row of (cardRows ?? []) as { card_id: string; qty: number }[]) {
          const def = findCard(row.card_id);
          if (!def) continue;
          if (isStation(def.tipo)) {
            station = publicCardDef(def);
            continue;
          }
          for (let i = 0; i < row.qty; i++) cardIds.push(row.card_id);
        }

        setLoadout({
          deckId,
          deckName: (deckRow as { nombre?: string } | null)?.nombre ?? null,
          cardIds,
          station,
          loading: false,
          ready: cardIds.length > 0,
        });
      } catch {
        if (active) setLoadout({ ...EMPTY, deckId });
      }
    })();

    return () => {
      active = false;
    };
  }, [deckId]);

  return loadout;
}
