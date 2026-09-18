/**
 * useDecks — Supabase-backed deck persistence hook.
 *
 * When SUPABASE_ENABLED is false the hook returns a disabled/empty state and
 * every mutation is a no-op that resolves without throwing. This lets the UI
 * render a graceful degraded state without any code-path divergence.
 *
 * createDeckImpl is exported for unit testing.
 */

import { useCallback, useEffect, useState } from 'react';

import type { DeckCardItem, DeckSummary } from '@/lib/decks/mappers';
import { SUPABASE_ENABLED } from '@/lib/config';
import { supabase } from '@/lib/session';

// Re-export for testing
export type { DeckSummary };

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UseDecksResult {
  decks: DeckSummary[];
  loading: boolean;
  error: string | null;
  /** Whether Supabase is configured (SUPABASE_ENABLED). */
  enabled: boolean;
  createDeck(nombre: string): Promise<DeckSummary | null>;
  renameDeck(id: string, nombre: string): Promise<void>;
  deleteDeck(id: string): Promise<void>;
  loadDeck(id: string): Promise<{ id: string; nombre: string; owner: string; cards: DeckCardItem[]; createdAt: string; updatedAt: string } | null>;
  addCard(deckId: string, cardId: string, qty?: number): Promise<void>;
  removeCard(deckId: string, cardId: string): Promise<void>;
  setQty(deckId: string, cardId: string, qty: number): Promise<void>;
  refresh(): Promise<void>;
}

// ─── Exported pure impl (unit-test seam) ─────────────────────────────────────

/**
 * Pure implementation of the createDeck operation, extracted so it can be
 * tested without a React runtime.
 *
 * @param enabled   - Value of SUPABASE_ENABLED.
 * @param nombre    - Deck name.
 * @param getClient - Factory that returns a Supabase-compatible client.
 */
export async function createDeckImpl(
  enabled: boolean,
  nombre: string,
  getClient: () => Promise<{ from: (table: string) => unknown }>,
): Promise<DeckSummary | null> {
  if (!enabled) return null;

  const client = await getClient();
  const table = client.from('decks') as {
    insert: (row: object) => {
      select: () => {
        single: () => Promise<{
          data: { id: string; nombre: string; owner: string; created_at: string; updated_at: string } | null;
          error: unknown;
        }>;
      };
    };
  };

  const { data, error } = await table.insert({ nombre }).select().single();
  if (error) throw new Error(String(error));
  if (!data) return null;

  return {
    id: data.id,
    nombre: data.nombre,
    owner: data.owner,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDecks(): UseDecksResult {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    setLoading(true);
    setError(null);
    try {
      const client = await supabase();
      const { data, error: queryError } = await client
        .from('decks')
        .select('id, owner, nombre, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (queryError) throw new Error(queryError.message);

      setDecks(
        (data ?? []).map(
          (row: { id: string; owner: string; nombre: string; created_at: string; updated_at: string }) => ({
            id: row.id,
            owner: row.owner,
            nombre: row.nombre,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createDeck = useCallback(
    async (nombre: string): Promise<DeckSummary | null> => {
      if (!SUPABASE_ENABLED) return null;
      const result = await createDeckImpl(SUPABASE_ENABLED, nombre, supabase);
      if (result) setDecks((prev) => [result, ...prev]);
      return result;
    },
    [],
  );

  const renameDeck = useCallback(async (id: string, nombre: string): Promise<void> => {
    if (!SUPABASE_ENABLED) return;
    const client = await supabase();
    const { error: updateError } = await client
      .from('decks')
      .update({ nombre })
      .eq('id', id);
    if (updateError) throw new Error(updateError.message);
    setDecks((prev) =>
      prev.map((d) => (d.id === id ? { ...d, nombre } : d)),
    );
  }, []);

  const deleteDeck = useCallback(async (id: string): Promise<void> => {
    if (!SUPABASE_ENABLED) return;
    const client = await supabase();
    const { error: deleteError } = await client.from('decks').delete().eq('id', id);
    if (deleteError) throw new Error(deleteError.message);
    setDecks((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const loadDeck = useCallback(
    async (id: string) => {
      if (!SUPABASE_ENABLED) return null;
      const client = await supabase();

      const { data: deckData, error: deckError } = await client
        .from('decks')
        .select('id, owner, nombre, created_at, updated_at')
        .eq('id', id)
        .single();
      if (deckError) throw new Error(deckError.message);
      if (!deckData) return null;

      const { data: cardData, error: cardError } = await client
        .from('deck_cards')
        .select('card_id, qty')
        .eq('deck_id', id);
      if (cardError) throw new Error(cardError.message);

      return {
        id: deckData.id as string,
        owner: deckData.owner as string,
        nombre: deckData.nombre as string,
        createdAt: deckData.created_at as string,
        updatedAt: deckData.updated_at as string,
        cards: (cardData ?? []) as DeckCardItem[],
      };
    },
    [],
  );

  const addCard = useCallback(
    async (deckId: string, cardId: string, qty = 1): Promise<void> => {
      if (!SUPABASE_ENABLED) return;
      const client = await supabase();
      const { error: upsertError } = await client
        .from('deck_cards')
        .upsert({ deck_id: deckId, card_id: cardId, qty }, { onConflict: 'deck_id,card_id' });
      if (upsertError) throw new Error(upsertError.message);
    },
    [],
  );

  const removeCard = useCallback(
    async (deckId: string, cardId: string): Promise<void> => {
      if (!SUPABASE_ENABLED) return;
      const client = await supabase();
      const { error: deleteError } = await client
        .from('deck_cards')
        .delete()
        .eq('deck_id', deckId)
        .eq('card_id', cardId);
      if (deleteError) throw new Error(deleteError.message);
    },
    [],
  );

  const setQty = useCallback(
    async (deckId: string, cardId: string, qty: number): Promise<void> => {
      if (!SUPABASE_ENABLED) return;
      const client = await supabase();
      const { error: updateError } = await client
        .from('deck_cards')
        .update({ qty })
        .eq('deck_id', deckId)
        .eq('card_id', cardId);
      if (updateError) throw new Error(updateError.message);
    },
    [],
  );

  return {
    decks,
    loading,
    error,
    enabled: SUPABASE_ENABLED,
    createDeck,
    renameDeck,
    deleteDeck,
    loadDeck,
    addCard,
    removeCard,
    setQty,
    refresh,
  };
}
