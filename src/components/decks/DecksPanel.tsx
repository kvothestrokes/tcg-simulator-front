/**
 * DecksPanel — top-level panel for the /decks route.
 *
 * Composes DeckList and DeckEditor. Renders a disabled/empty state when
 * SUPABASE_ENABLED is false (enabled === false from useDecks).
 *
 * Mounted from decks.astro as <DecksPanel client:only="react" />.
 */

import { useCallback, useEffect, useState } from 'react';

import type { DeckCardItem } from '@/lib/decks/mappers';
import type { DeckSummary } from '@/hooks/useDecks';
import { useDecks } from '@/hooks/useDecks';
import { useSession } from '@/hooks/useSession';
import { hydrateCatalog } from '@/lib/game/cards';
import { loginPath } from '@/lib/navigation';
import { Panel } from '@/components/ui/Panel';
import { DeckList } from './DeckList';
import { DeckEditor } from './DeckEditor';

export function DecksPanel() {
  const { identity, loading: sessionLoading } = useSession();
  const {
    decks,
    loading: decksLoading,
    error,
    enabled,
    createDeck,
    renameDeck,
    deleteDeck,
    loadDeck,
    addCard,
    removeCard,
    setQty,
    refresh,
  } = useDecks();

  const [selected, setSelected] = useState<DeckSummary | null>(null);
  const [deckItems, setDeckItems] = useState<DeckCardItem[]>([]);

  // Hydrate the card catalog cache once at route entry so findCard() and the
  // engine helpers resolve DB-backed cards, not just the SAMPLE_CATALOG fallback.
  useEffect(() => {
    void hydrateCatalog();
  }, []);

  // Redirect to login if Supabase is configured but user isn't signed in
  useEffect(() => {
    if (!sessionLoading && enabled && !identity) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/decks';
      window.location.href = loginPath(next);
    }
  }, [sessionLoading, identity, enabled]);

  const handleSelect = useCallback(
    async (deck: DeckSummary) => {
      setSelected(deck);
      setDeckItems([]);
      const full = await loadDeck(deck.id);
      if (full) setDeckItems(full.cards);
    },
    [loadDeck],
  );

  const handleCreate = useCallback(
    async (nombre: string) => {
      const newDeck = await createDeck(nombre);
      if (newDeck) await refresh();
    },
    [createDeck, refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDeck(id);
      if (selected?.id === id) {
        setSelected(null);
        setDeckItems([]);
      }
    },
    [deleteDeck, selected],
  );

  const handleAddCard = useCallback(
    async (deckId: string, cardId: string, qty: number) => {
      await addCard(deckId, cardId, qty);
      // Reload deck items
      if (selected?.id === deckId) {
        const full = await loadDeck(deckId);
        if (full) setDeckItems(full.cards);
      }
    },
    [addCard, loadDeck, selected],
  );

  const handleRemoveCard = useCallback(
    async (deckId: string, cardId: string) => {
      await removeCard(deckId, cardId);
      setDeckItems((prev) => prev.filter((i) => i.card_id !== cardId));
    },
    [removeCard],
  );

  const handleSetQty = useCallback(
    async (deckId: string, cardId: string, qty: number) => {
      await setQty(deckId, cardId, qty);
      setDeckItems((prev) =>
        prev.map((i) => (i.card_id === cardId ? { ...i, qty } : i)),
      );
    },
    [setQty],
  );

  // Disabled / offline state
  if (!enabled) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-7xl mx-auto">
        <a className="btn btn--sm btn--ghost self-start" href="/lobby">
          ← Back
        </a>
        <Panel tone="dim" cut={12} innerClassName="px-6 py-8 text-center">
          <p className="hud-title text-sm mb-2">Deck Builder</p>
          <p className="hud-sub text-[11px] opacity-60">
            Supabase is not configured. Deck persistence is disabled.
            Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable it.
          </p>
        </Panel>
      </div>
    );
  }

  // Loading identity
  if (sessionLoading) {
    return <p className="hud-sub animate-pulse text-[11px]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <a className="btn btn--sm btn--ghost" href="/lobby">
          ← Back
        </a>
        <h1 className="hud-title text-lg">Deck Builder</h1>
      </div>

      {error ? (
        <p className="text-sm text-[#fda4af] border border-[rgba(244,63,94,0.4)] bg-[rgba(244,63,94,0.08)] px-4 py-2">
          {error}
        </p>
      ) : null}

      {selected ? (
        <DeckEditor
          deck={selected}
          items={deckItems}
          onRename={renameDeck}
          onAddCard={handleAddCard}
          onRemoveCard={handleRemoveCard}
          onSetQty={handleSetQty}
          onBack={() => {
            setSelected(null);
            setDeckItems([]);
          }}
        />
      ) : (
        <DeckList
          decks={decks}
          selectedId={null}
          loading={decksLoading}
          onSelect={(deck) => void handleSelect(deck)}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
