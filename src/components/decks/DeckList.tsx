/**
 * DeckList — displays the user's saved decks and allows creating/deleting them.
 */

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import type { DeckSummary } from '@/hooks/useDecks';
import { Panel } from '@/components/ui/Panel';

interface DeckListProps {
  decks: DeckSummary[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (deck: DeckSummary) => void;
  onCreate: (nombre: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DeckList({ decks, selectedId, loading, onSelect, onCreate, onDelete }: DeckListProps) {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const name = newName.trim();
      if (!name) return;
      setBusy(true);
      try {
        await onCreate(name);
        setNewName('');
      } finally {
        setBusy(false);
      }
    },
    [newName, onCreate],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await onDelete(id);
      } finally {
        setBusy(false);
      }
    },
    [onDelete],
  );

  return (
    <Panel cut={12} innerClassName="flex flex-col gap-3 p-3">
      <h2 className="hud-title text-sm">My Decks</h2>

      <form onSubmit={(e) => void handleCreate(e)} className="flex gap-2">
        <input
          className="field flex-1 text-sm"
          placeholder="New deck name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={64}
          disabled={busy}
        />
        <button
          type="submit"
          className="btn btn--sm btn--primary"
          disabled={busy || newName.trim() === ''}
        >
          Create
        </button>
      </form>

      {loading ? (
        <p className="hud-sub text-[10px] animate-pulse">Loading decks…</p>
      ) : decks.length === 0 ? (
        <p className="hud-sub text-[10px] opacity-60">No decks yet. Create one above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-stroke-faint)]">
          {decks.map((deck) => (
            <li
              key={deck.id}
              className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors hover:bg-[rgba(255,255,255,0.03)] ${selectedId === deck.id ? 'bg-[rgba(255,255,255,0.04)]' : ''}`}
            >
              <button
                type="button"
                className={`flex-1 cursor-pointer text-left text-sm truncate ${selectedId === deck.id ? 'text-[var(--color-signal)]' : 'text-[var(--color-ink)]'}`}
                onClick={() => onSelect(deck)}
                title={`Open ${deck.nombre}`}
              >
                {deck.nombre}
              </button>
              <button
                type="button"
                className="btn btn--sm btn--primary shrink-0 cursor-pointer"
                onClick={() => onSelect(deck)}
                aria-label={`Edit and view deck ${deck.nombre}`}
              >
                Edit / View
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger shrink-0 cursor-pointer"
                disabled={busy}
                onClick={() => void handleDelete(deck.id)}
                aria-label={`Delete deck ${deck.nombre}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
