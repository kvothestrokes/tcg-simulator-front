/**
 * Unit tests for useDecks — mocked supabase client.
 *
 * Because the Vitest environment is `node` (no DOM), React hooks cannot be
 * rendered here. We test the SUPABASE_ENABLED guard paths via the exported
 * `createDeckImpl` and `buildDecksClient` helper that the hook delegates to.
 *
 * Spec scenarios covered:
 *   - SUPABASE_ENABLED=false: createDeck resolves without throw, returns null.
 *   - SUPABASE_ENABLED=true: createDeck triggers one INSERT into `decks` with
 *     nombre="MyDeck".
 */

import { describe, expect, it, vi } from 'vitest';

import { createDeckImpl } from './useDecks';

// ─── Shared mock factory ─────────────────────────────────────────────────────

function makeClientMock(singleResult = { data: { id: 'deck-id', nombre: 'MyDeck', owner: 'u1', created_at: '', updated_at: '' }, error: null }) {
  const singleSpy = vi.fn().mockResolvedValue(singleResult);
  const selectSpy = vi.fn().mockReturnValue({ single: singleSpy });
  const insertSpy = vi.fn().mockReturnValue({ select: selectSpy });

  const fromSpy = vi.fn().mockReturnValue({ insert: insertSpy });

  return { fromSpy, insertSpy, selectSpy, singleSpy };
}

// ─── SUPABASE_ENABLED = false ─────────────────────────────────────────────────

describe('createDeckImpl with SUPABASE_ENABLED = false', () => {
  it('resolves without throwing and returns null', async () => {
    const mockGetClient = vi.fn();
    const result = await createDeckImpl(false, 'test', mockGetClient);

    expect(result).toBeNull();
    expect(mockGetClient).not.toHaveBeenCalled();
  });

  it('does not throw when called with any name', async () => {
    const mockGetClient = vi.fn();
    await expect(createDeckImpl(false, '', mockGetClient)).resolves.toBeNull();
  });
});

// ─── SUPABASE_ENABLED = true ──────────────────────────────────────────────────

describe('createDeckImpl with SUPABASE_ENABLED = true', () => {
  it('calls INSERT into decks with nombre="MyDeck"', async () => {
    const { fromSpy, insertSpy } = makeClientMock();
    const mockGetClient = vi.fn().mockResolvedValue({ from: fromSpy });

    await createDeckImpl(true, 'MyDeck', mockGetClient);

    expect(fromSpy).toHaveBeenCalledWith('decks');
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const insertArg = insertSpy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(insertArg?.['nombre']).toBe('MyDeck');
  });

  it('returns the deck data from the Supabase response', async () => {
    const { fromSpy } = makeClientMock({
      data: { id: 'created-id', nombre: 'Alpha Deck', owner: 'user-1', created_at: '2026-01-01', updated_at: '2026-01-01' },
      error: null,
    });
    const mockGetClient = vi.fn().mockResolvedValue({ from: fromSpy });

    const result = await createDeckImpl(true, 'Alpha Deck', mockGetClient);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('created-id');
    expect(result!.nombre).toBe('Alpha Deck');
  });
});
