/**
 * Hangar: crear una sala o entrar a una existente.
 *
 * Usa tres endpoints del backend:
 *   POST /v1/rooms                crear (el creador ocupa el asiento 1)
 *   GET  /v1/rooms/{code}         comprobar antes de entrar
 *   POST /v1/rooms/{code}/join    ocupar el asiento libre
 *
 * Las salas recientes se guardan en local para poder reanudar una partida sin
 * tener que recordar el código.
 */

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import { Panel, PanelSection } from '../ui/Panel';
import { StatusDot } from '../ui/StatusDot';
import { Wordmark } from '../ui/Wordmark';
import { useSession } from '../../hooks/useSession';
import { ApiError, RealtimeApi, errorMessage, type HealthResponse, type RoomResponse } from '../../lib/api';
import { roomPath } from '../../lib/config';
import { loginPath } from '../../lib/navigation';
import { getAccessToken, shortName } from '../../lib/session';

const RECENT_KEY = 'cb:recent-rooms';
const MAX_RECENT = 6;

const ROOM_STATUS_LABEL: Record<string, string> = {
  waiting: 'Esperando rival',
  active: 'En curso',
  finished: 'Terminada',
  abandoned: 'Abandonada',
};

interface RecentRoom {
  code: string;
  at: number;
  status: string;
}

export function Lobby() {
  const { identity, loading, signOut } = useSession();
  const api = useMemo(() => new RealtimeApi(getAccessToken), []);

  const [code, setCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRoom[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    if (loading || identity) return;
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = loginPath(next);
  }, [loading, identity]);

  // Las salas recientes se guardan en local, pero su estado puede haber
  // cambiado (la terminó el rival, por ejemplo): se consulta al backend.
  useEffect(() => {
    const stored = readRecent();
    setRecent(stored);
    if (stored.length === 0) return;

    const controller = new AbortController();
    void Promise.all(
      stored.map(async (entry) => {
        try {
          const response = await api.getRoom(entry.code, controller.signal);
          return { ...entry, status: response.room.status };
        } catch {
          // Sala borrada o sin acceso: se conserva la entrada tal cual.
          return entry;
        }
      }),
    ).then((updated) => {
      if (!controller.signal.aborted) setRecent(updated);
    });

    return () => controller.abort();
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .health(controller.signal)
      .then(setHealth)
      .catch(() => undefined);
    return () => controller.abort();
  }, [api]);

  // Si llegas con ?code= (enlace compartido), se rellena solo.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) setCode(fromUrl.toUpperCase());
  }, []);

  const enterRoom = useCallback((response: RoomResponse) => {
    rememberRoom(response.room.code, response.room.status);
    window.location.href = roomPath(response.room.code);
  }, []);

  const handleCreate = useCallback(async () => {
    setBusy('create');
    setError(null);
    try {
      const wanted = customCode.trim().toUpperCase();
      enterRoom(await api.createRoom(wanted || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.humanMessage : errorMessage(err));
      setBusy(null);
    }
  }, [api, customCode, enterRoom]);

  const handleJoin = useCallback(
    async (event: SyntheticEvent) => {
      event.preventDefault();
      const wanted = code.trim().toUpperCase();
      if (!wanted) return;

      setBusy('join');
      setError(null);
      try {
        // Se va directo al join: ya devuelve el error exacto (ROOM_NOT_FOUND,
        // ROOM_FULL, ROOM_CLOSED). Consultar antes con GET solo añadiría un 404
        // esperado en la consola, porque todavía no eres jugador de la sala.
        enterRoom(await api.joinRoom(wanted));
      } catch (err) {
        setError(err instanceof ApiError ? err.humanMessage : errorMessage(err));
        setBusy(null);
      }
    },
    [api, code, enterRoom],
  );

  if (loading || !identity) {
    return <p className="hud-sub animate-ping-slow">Cargando…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Wordmark size="sm" />
        <div className="flex items-center gap-3 text-xs">
          <span className="hud-sub">
            {identity.label}
            <span className="ml-2 text-[var(--color-stroke-dim)]">
              #{shortName(identity.userId)}
            </span>
          </span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {/* --- crear ------------------------------------------------------- */}
        <PanelSection title="Nueva partida" titleSize="lg" cut={16} bodyClassName="p-4 pt-2">
          <p className="mb-4 text-sm text-[var(--color-ink-dim)]">
            Creas la sala y ocupas el asiento 1. Comparte el código con tu rival para que
            ocupe el 2.
          </p>

          <label className="hud-sub mb-2 block" htmlFor="custom-code">
            Código propio (opcional)
          </label>
          <input
            id="custom-code"
            className="field mb-4"
            placeholder="Se genera solo"
            maxLength={12}
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
          />

          <button
            type="button"
            className="btn btn--primary w-full"
            onClick={() => void handleCreate()}
            disabled={busy !== null}
          >
            {busy === 'create' ? 'Creando…' : 'Crear sala'}
          </button>
          <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
            Sin caracteres ambiguos: nada de 0, O, 1, I ni L.
          </p>
        </PanelSection>

        {/* --- entrar ------------------------------------------------------ */}
        <PanelSection title="Entrar a una sala" titleSize="lg" cut={16} bodyClassName="p-4 pt-2">
          <p className="mb-4 text-sm text-[var(--color-ink-dim)]">
            Introduce el código que te pasaron. Si ya estabas en esa partida, vuelves a tu
            mismo asiento.
          </p>

          <form onSubmit={handleJoin}>
            <label className="hud-sub mb-2 block" htmlFor="join-code">
              Código de sala
            </label>
            <input
              id="join-code"
              className="field mb-4 text-center text-2xl tracking-[0.3em]"
              placeholder="ABC123"
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
            />
            <button
              type="submit"
              className="btn w-full"
              disabled={busy !== null || code.trim().length < 4}
            >
              {busy === 'join' ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </PanelSection>
      </div>

      {error ? (
        <p className="border border-[rgba(244,63,94,0.4)] bg-[rgba(244,63,94,0.08)] px-4 py-3 text-sm text-[#fda4af]">
          {error}
        </p>
      ) : null}

      {/* --- recientes ----------------------------------------------------- */}
      {recent.length > 0 ? (
        <PanelSection
          title="Partidas recientes"
          tone="dim"
          bodyClassName="p-2"
          meta={`${recent.length}`}
        >
          <ul className="divide-y divide-[var(--color-stroke-faint)]">
            {recent.map((entry) => (
              <li key={entry.code} className="flex items-center justify-between gap-3 px-2 py-2">
                <div className="min-w-0">
                  <p className="display text-sm tracking-[0.2em]">{entry.code}</p>
                  <p className="text-[11px] text-[var(--color-ink-faint)]">
                    {ROOM_STATUS_LABEL[entry.status] ?? entry.status} ·{' '}
                    {new Date(entry.at).toLocaleString('es')}
                  </p>
                </div>
                {entry.status === 'finished' || entry.status === 'abandoned' ? (
                  <span className="hud-sub shrink-0 text-[10px]">Terminada</span>
                ) : (
                  <a className="btn btn--sm shrink-0" href={roomPath(entry.code)}>
                    Reanudar
                  </a>
                )}
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      <Panel tone="dim" cut={10} innerClassName="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-ink-faint)]">
          <span className="flex items-center gap-2">
            <StatusDot on={health?.status === 'ok'} pulse />
            <span className="hud-sub">
              {health ? `Servicio ${health.status}` : 'Servicio desconocido'}
            </span>
          </span>
          {health ? (
            <>
              <span>Salas activas: {health.rooms}</span>
              <span>Conexiones: {health.connections}</span>
              <span>Base de datos: {health.database}</span>
            </>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

// --- salas recientes ---------------------------------------------------------

function readRecent(): RecentRoom[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentRoom[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function rememberRoom(code: string, status: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = readRecent().filter((entry) => entry.code !== code);
    const next = [{ code, status, at: Date.now() }, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento simplemente no hay historial.
  }
}
