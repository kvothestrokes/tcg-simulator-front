/**
 * Unit tests for the catalog source swap in cards.ts.
 * Written FIRST (RED phase) — then implementation in GREEN phase.
 *
 * Spec scenarios covered:
 *   - SUPABASE_ENABLED=false → loadCatalog returns SAMPLE_CATALOG; no supabase() call.
 *   - SUPABASE_ENABLED=true, mocked client returning 2 rows →
 *     loadCatalog returns those 2 mapped rows (not SAMPLE_CATALOG).
 *   - hydrateCatalog is exported as a function and resolves without throwing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mutable flag (shared between mock factory and tests) ────────────────────

const configState = { SUPABASE_ENABLED: false };

// Mock config — factory reads from mutable configState
vi.mock('@/lib/config', () => ({
  get SUPABASE_ENABLED() { return configState.SUPABASE_ENABLED; },
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',
  SUPABASE_ANON_KEY: '',
  TURNSTILE_SITE_KEY: '',
  REALTIME_URL: 'http://localhost:8080',
  REALTIME_WS_URL: 'ws://localhost:8080',
  roomPath: (code: string) => `/room/?code=${code}`,
  roomShareUrl: (code: string) => `/room/?code=${code}`,
}));

// Mock session so supabase() returns a controlled client
const sessionState = {
  supabaseMock: vi.fn().mockResolvedValue(null),
};

vi.mock('@/lib/session', () => ({
  get supabase() { return sessionState.supabaseMock; },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFakeRow(id: string) {
  return {
    id,
    nombre: `Card ${id}`,
    tipo: 'Nave' as const,
    faccion: 'CyberPunk',
    rareza: 'Común',
    data: {
      coste_recursos: 1,
      coste_heat: 0,
      numero_coleccion: id.toUpperCase(),
      autor: '',
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadCatalog with SUPABASE_ENABLED = false', () => {
  beforeEach(() => {
    configState.SUPABASE_ENABLED = false;
    sessionState.supabaseMock.mockClear();
  });

  it('returns SAMPLE_CATALOG without calling supabase()', async () => {
    const { loadCatalog, SAMPLE_CATALOG } = await import('./cards');

    const result = await loadCatalog();

    expect(result).toBe(SAMPLE_CATALOG);
    expect(sessionState.supabaseMock).not.toHaveBeenCalled();
  });
});

describe('loadCatalog with SUPABASE_ENABLED = true', () => {
  beforeEach(() => {
    configState.SUPABASE_ENABLED = true;
    sessionState.supabaseMock.mockClear();
  });

  it('returns the mapped DB rows when Supabase returns 2 rows', async () => {
    const fakeRows = [makeFakeRow('db_001'), makeFakeRow('db_002')];

    // Set up the client mock to return our fake rows
    sessionState.supabaseMock.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: fakeRows, error: null }),
      }),
    });

    const { loadCatalog, SAMPLE_CATALOG } = await import('./cards');
    const result = await loadCatalog();

    // Must return DB rows, NOT SAMPLE_CATALOG
    expect(result).not.toBe(SAMPLE_CATALOG);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('db_001');
    expect(result[1]!.id).toBe('db_002');
    // supabase() must have been called
    expect(sessionState.supabaseMock).toHaveBeenCalled();
  });
});

describe('hydrateCatalog', () => {
  it('exports hydrateCatalog as a function', async () => {
    const { hydrateCatalog } = await import('./cards');
    expect(typeof hydrateCatalog).toBe('function');
  });

  it('resolves without throwing', async () => {
    configState.SUPABASE_ENABLED = false;
    const { hydrateCatalog } = await import('./cards');
    await expect(hydrateCatalog()).resolves.not.toThrow();
  });
});
