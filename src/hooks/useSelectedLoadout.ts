/**
 * useSelectedLoadout — resolves the player's chosen deck into the cards they will
 * actually play with in a match.
 *
 * It reads the selected deck id (see lib/decks/selectedDeck), loads that deck's
 * rows, and expands them by quantity into a flat list of non-station card ids
 * plus the single station def. usePrivateDeck consumes this on SETUP so the deck
 * you built is the deck you draw from — never the hardcoded starter.
 *
 * It also checks the deck against the construction rules (deckLegality) and
 * exposes `playBlock`, the Spanish reason why the match cannot start with it.
 * There is no starter-deck fallback anymore (see lib/decks/matchGate): with no
 * legal deck selected, `playBlock` is set and the table does not run SETUP.
 *
 * Pass `deckIdOverride` to resolve a deck other than the stored selection (the
 * lobby does this while the player is choosing).
 */

import { useEffect, useMemo, useState } from 'react';

import type { CardDef } from '@/lib/game/types';
import type { DeckCardItem } from '@/lib/decks/mappers';
import {
  buildStarterDeck,
  findCard,
  getStarterStation,
  hydrateCatalog,
  publicCardDef,
} from '@/lib/game/cards';
import { deckLegality, isStation, type DeckLegality } from '@/lib/decks/validation';
import { matchStartBlock } from '@/lib/decks/matchGate';
import { getSelectedDeckId } from '@/lib/decks/selectedDeck';
import { SUPABASE_ENABLED } from '@/lib/config';
import { supabase } from '@/lib/session';
import { isTestMode } from '@/lib/testMode';

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
  /**
   * True once resolution finished for the current deck id (success, failure or
   * no deck selected). The automatic SETUP waits for it.
   */
  resolved: boolean;
  /** Construction-rule check of the resolved deck (null until resolved or with no deck). */
  legality: DeckLegality | null;
  /** Spanish reason why this loadout cannot start a match, or null when it can. */
  playBlock: string | null;
}

const EMPTY: Loadout = {
  deckId: null,
  deckName: null,
  cardIds: [],
  station: null,
  loading: false,
  ready: false,
  resolved: false,
  legality: null,
  playBlock: null,
};

function gate(
  deckId: string | null,
  deckExists: boolean,
  resolved: boolean,
  legality: DeckLegality | null,
): string | null {
  return matchStartBlock({ selectedDeckId: deckId, deckExists, resolved, legality });
}

export function useSelectedLoadout(
  userId: string | undefined,
  deckIdOverride?: string | null,
): Loadout {
  const stored = useMemo(() => getSelectedDeckId(userId), [userId]);
  const deckId = deckIdOverride === undefined ? stored : deckIdOverride;
  // Offline test mode (only via the `test` URL param, only for the table's own
  // loadout): the sample deck, explicitly exempt from the match-start gate. It
  // can never be legal (4 playable sample cards), and there is no Supabase deck.
  const [testMode] = useState(() => deckIdOverride === undefined && isTestMode());
  const [loadout, setLoadout] = useState<Loadout>(() => (testMode ? testLoadout() : EMPTY));

  useEffect(() => {
    if (testMode) return;
    if (!SUPABASE_ENABLED || !deckId) {
      setLoadout({
        ...EMPTY,
        deckId: deckId ?? null,
        resolved: true,
        playBlock: gate(deckId ?? null, false, true, null),
      });
      return;
    }

    let active = true;
    setLoadout({ ...EMPTY, deckId, loading: true, playBlock: gate(deckId, true, false, null) });

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
        const rows = (cardRows ?? []) as DeckCardItem[];
        const catalog = new Map<string, CardDef>();

        for (const row of rows) {
          const def = findCard(row.card_id);
          if (!def) continue;
          catalog.set(def.id, def);
          if (isStation(def.tipo)) {
            station = publicCardDef(def);
            continue;
          }
          for (let i = 0; i < row.qty; i++) cardIds.push(row.card_id);
        }

        const legality = deckLegality(rows, catalog);
        const deckExists = Boolean(deckRow);
        setLoadout({
          deckId,
          deckName: (deckRow as { nombre?: string } | null)?.nombre ?? null,
          cardIds,
          station,
          loading: false,
          ready: cardIds.length > 0,
          resolved: true,
          legality,
          playBlock: gate(deckId, deckExists, true, legality),
        });
      } catch {
        if (active) {
          setLoadout({
            ...EMPTY,
            deckId,
            resolved: true,
            playBlock: 'No se pudo cargar tu mazo. Vuelve a intentarlo.',
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [deckId, testMode]);

  return loadout;
}

/** Test-mode loadout: sample deck + sample station, no gate (see lib/testMode). */
function testLoadout(): Loadout {
  return {
    deckId: 'test-sample-deck',
    deckName: 'Mazo de ejemplo (prueba)',
    cardIds: buildStarterDeck(),
    station: getStarterStation(),
    loading: false,
    ready: true,
    resolved: true,
    legality: null,
    playBlock: null,
  };
}
