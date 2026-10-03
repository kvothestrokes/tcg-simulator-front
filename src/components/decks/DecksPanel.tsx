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
import type { CardDef } from '@/lib/game/types';
import type { DeckSummary } from '@/hooks/useDecks';
import { useDecks } from '@/hooks/useDecks';
import { useSession } from '@/hooks/useSession';
import { hydrateCatalog, loadCatalog, SAMPLE_CATALOG } from '@/lib/game/cards';
import { autofillDeck } from '@/lib/decks/autofill';
import { parseDeckFile } from '@/lib/decks/deckFile';
import { deckIssueMessage } from '@/lib/decks/matchGate';
import { DECK_RULES } from '@/lib/decks/validation';
import { loginPath } from '@/lib/navigation';
import { Panel } from '@/components/ui/Panel';
import { Wordmark } from '@/components/ui/Wordmark';
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
    upsertCards,
    clearDeck,
    refresh,
  } = useDecks();

  const [selected, setSelected] = useState<DeckSummary | null>(null);
  const [deckItems, setDeckItems] = useState<DeckCardItem[]>([]);
  /** Deck contents are still loading: bulk actions would act on a stale list. */
  const [itemsLoading, setItemsLoading] = useState(false);
  const [catalog, setCatalog] = useState<CardDef[]>(SAMPLE_CATALOG);
  /** Result of the last bulk action (autofill, clear, import), Spanish UI copy. */
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  // Hydrate the card catalog cache once at route entry so findCard() and the
  // engine helpers resolve DB-backed cards, not just the SAMPLE_CATALOG fallback.
  // The full list also feeds autofill and import.
  useEffect(() => {
    let active = true;
    void hydrateCatalog()
      .then(() => loadCatalog())
      .then((cards) => {
        if (active) setCatalog(cards);
      });
    return () => {
      active = false;
    };
  }, []);

  const reloadItems = useCallback(
    async (deckId: string) => {
      const full = await loadDeck(deckId);
      if (full) setDeckItems(full.cards);
    },
    [loadDeck],
  );

  const handleAutofill = useCallback(
    async (deckId: string) => {
      const result = autofillDeck(deckItems, catalog);
      const before = new Map(deckItems.map((item) => [item.card_id, item.qty]));
      const changed = result.items.filter((item) => before.get(item.card_id) !== item.qty);
      try {
        await upsertCards(deckId, changed);
        await reloadItems(deckId);
        const station = result.stationAdded
          ? ` y la estación ${catalog.find((c) => c.id === result.stationAdded)?.nombre ?? result.stationAdded}`
          : '';
        setNotice(
          result.complete
            ? { tone: 'ok', text: `Autocompletado: +${result.added} carta${result.added === 1 ? '' : 's'}${station}.` }
            : {
                tone: 'warn',
                text: `El catálogo no alcanza para ${DECK_RULES.MAX_DECK_CARDS} cartas legales (máx. ${DECK_RULES.MAX_COPIES} copias): +${result.added}${station}.`,
              },
        );
      } catch (err) {
        setNotice({ tone: 'warn', text: `No se pudo autocompletar: ${err instanceof Error ? err.message : String(err)}` });
      }
    },
    [catalog, deckItems, reloadItems, upsertCards],
  );

  const handleClear = useCallback(
    async (deckId: string) => {
      try {
        await clearDeck(deckId);
        setDeckItems([]);
        setNotice({ tone: 'ok', text: 'Mazo vaciado.' });
      } catch (err) {
        setNotice({ tone: 'warn', text: `No se pudo vaciar: ${err instanceof Error ? err.message : String(err)}` });
      }
    },
    [clearDeck],
  );

  /** Imports a JSON deck file into a NEW deck (never overwrites an existing one). */
  const handleImport = useCallback(
    async (text: string) => {
      const parsed = parseDeckFile(text, new Map(catalog.map((card) => [card.id, card])));
      if (!parsed.ok) {
        setNotice({ tone: 'warn', text: `Importación cancelada: ${parsed.error}` });
        return;
      }
      try {
        const created = await createDeck(parsed.name);
        if (!created) {
          setNotice({ tone: 'warn', text: 'No se pudo crear el mazo importado.' });
          return;
        }
        await upsertCards(created.id, parsed.items);
        await refresh();
        const parts = [`Importado «${created.nombre}» como mazo nuevo.`];
        if (parsed.unknownIds.length) {
          parts.push(`Cartas desconocidas omitidas: ${parsed.unknownIds.join(', ')}.`);
        }
        if (parsed.trimmed.length) {
          parts.push(
            `Recortadas por las reglas: ${parsed.trimmed.map((t) => `${t.id} (${t.kept}/${t.requested})`).join(', ')}.`,
          );
        }
        if (!parsed.legality.ok) {
          parts.push(`Aún no es legal: ${parsed.legality.issues.map(deckIssueMessage).join('; ')}.`);
        }
        setNotice({
          tone: parsed.legality.ok && !parsed.unknownIds.length && !parsed.trimmed.length ? 'ok' : 'warn',
          text: parts.join(' '),
        });
      } catch (err) {
        setNotice({ tone: 'warn', text: `No se pudo importar: ${err instanceof Error ? err.message : String(err)}` });
      }
    },
    [catalog, createDeck, refresh, upsertCards],
  );

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
      setNotice(null);
      setItemsLoading(true);
      try {
        const full = await loadDeck(deck.id);
        if (full) setDeckItems(full.cards);
      } finally {
        setItemsLoading(false);
      }
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
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="orbit-rings" aria-hidden="true" />
      <div className="relative z-[1] flex items-center gap-3">
        <a className="btn btn--sm btn--ghost" href="/lobby">
          ← Back
        </a>
        <Wordmark size="sm" />
        <h1 className="hud-title text-aurora text-lg">Mazos</h1>
      </div>

      {error ? (
        <p className="text-sm text-[#fda4af] border border-[rgba(244,63,94,0.4)] bg-[rgba(244,63,94,0.08)] px-4 py-2">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className={`flex items-start justify-between gap-3 border px-4 py-2 text-sm ${
            notice.tone === 'ok'
              ? 'border-[rgba(74,222,128,0.4)] bg-[rgba(74,222,128,0.08)] text-[#86efac]'
              : 'border-[rgba(251,191,36,0.4)] bg-[rgba(251,191,36,0.08)] text-[var(--color-heat)]'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="hud-sub shrink-0 underline"
            onClick={() => setNotice(null)}
            title="Ocultar este aviso"
          >
            Cerrar
          </button>
        </p>
      ) : null}

      {selected ? (
        <DeckEditor
          deck={selected}
          items={deckItems}
          itemsLoading={itemsLoading}
          onAutofill={() => handleAutofill(selected.id)}
          onClear={() => handleClear(selected.id)}
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
          onImport={handleImport}
        />
      )}
    </div>
  );
}
