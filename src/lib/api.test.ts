import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, RealtimeApi, errorMessage } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RealtimeApi', () => {
  it('envía Bearer y crea una sala', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          room: {
            id: 'r1',
            code: 'NEON01',
            status: 'waiting',
            createdBy: 'u1',
            currentSequence: 0,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          players: [],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = new RealtimeApi(async () => 'jwt-test', 'http://realtime.test');
    const result = await api.createRoom('neon01');

    expect(result.room.code).toBe('NEON01');
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe('http://realtime.test/v1/rooms');
    const init = request?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-test');
    expect(init.body).toBe(JSON.stringify({ code: 'NEON01' }));
  });

  it('health no exige token', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'ok',
          database: 'ok',
          rooms: 0,
          connections: 0,
          uptimeSeconds: 1,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = new RealtimeApi(async () => {
      throw new Error('no debería pedir token');
    }, 'http://realtime.test');
    await api.health();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('traduce errores estructurados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'ROOM_FULL', message: 'full' } }), {
          status: 409,
        }),
      ),
    );
    const api = new RealtimeApi(async () => 'jwt', 'http://realtime.test');
    await expect(api.joinRoom('NEON01')).rejects.toMatchObject({
      code: 'ROOM_FULL',
      status: 409,
    });
  });

  it('falla sin sesión en rutas autenticadas', async () => {
    const api = new RealtimeApi(async () => null, 'http://realtime.test');
    await expect(api.getRoom('NEON01')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('errorMessage', () => {
  it('usa el texto humano del código', () => {
    expect(errorMessage(new ApiError('ROOM_CLOSED', 'x', 409))).toBe('Esa partida ya terminó.');
  });
});
