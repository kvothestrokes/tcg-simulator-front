/**
 * Pantalla de acceso.
 *
 * Dos vías según la configuración:
 *   · Supabase Auth por magic link (producción).
 *   · Invitado, pidiendo un JWT a POST /v1/dev/token, que solo existe con el
 *     backend en modo desarrollo.
 *
 * Además muestra el estado del servicio de tiempo real: si está caído, más vale
 * saberlo aquí que al abrir una sala.
 */

import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';

import { Panel } from '../ui/Panel';
import { StatusDot } from '../ui/StatusDot';
import { Wordmark } from '../ui/Wordmark';
import { useSession } from '../../hooks/useSession';
import { RealtimeApi, errorMessage, type HealthResponse } from '../../lib/api';
import { DEV_AUTH_ENABLED, REALTIME_URL, SUPABASE_ENABLED } from '../../lib/config';
import { defaultCallsign, devSignIn, signInWithEmail } from '../../lib/session';

const api = new RealtimeApi(async () => null);

export function SignIn() {
  const { identity, loading } = useSession();
  const [email, setEmail] = useState('');
  const [callsign, setCallsign] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);

  // Si ya hay sesión, esta pantalla no pinta nada.
  useEffect(() => {
    if (!loading && identity) window.location.href = '/lobby/';
  }, [loading, identity]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .health(controller.signal)
      .then(setHealth)
      .catch(() => {
        if (!controller.signal.aborted) setHealthError(true);
      });
    return () => controller.abort();
  }, []);

  const handleMagicLink = useCallback(
    async (event: SyntheticEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await signInWithEmail(email.trim());
        setNotice('Te enviamos un enlace de acceso. Revisa tu correo.');
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [email],
  );

  const handleGuest = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const identity = await devSignIn(callsign.trim() || undefined);
      window.location.href = '/lobby/';
      return identity;
    } catch (err) {
      setError(
        errorMessage(err) +
          ' El modo invitado necesita el backend con APP_ENV=development.',
      );
      setBusy(false);
      return null;
    }
  }, [callsign]);

  if (loading || identity) {
    return <p className="hud-sub animate-ping-slow">Comprobando sesión…</p>;
  }

  return (
    <div className="w-full max-w-lg">
      <Wordmark size="lg" withRules className="mb-3" />
      <p className="mb-8 text-center text-sm text-[var(--color-ink-dim)]">
        Mesa virtual para partidas 1v1. Tú declaras las jugadas; el simulador solo las
        transmite y las recuerda.
      </p>

      <Panel cut={16} innerClassName="p-6">
        {SUPABASE_ENABLED ? (
          <form onSubmit={handleMagicLink} className="mb-6">
            <label className="hud-sub mb-2 block" htmlFor="email">
              Acceso con correo
            </label>
            <div className="flex gap-2">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="field field--text"
                placeholder="piloto@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="btn btn--primary shrink-0" disabled={busy}>
                Enviar
              </button>
            </div>
          </form>
        ) : (
          <p className="mb-6 text-xs text-[var(--color-ink-faint)]">
            Supabase Auth no está configurado. Define{' '}
            <code className="text-[var(--color-ink-dim)]">PUBLIC_SUPABASE_URL</code> y{' '}
            <code className="text-[var(--color-ink-dim)]">PUBLIC_SUPABASE_ANON_KEY</code> para
            habilitar el acceso con correo.
          </p>
        )}

        {DEV_AUTH_ENABLED ? (
          <div className={SUPABASE_ENABLED ? 'scanline-top pt-6' : ''}>
            <label className="hud-sub mb-2 block" htmlFor="callsign">
              Entrar como invitado
            </label>
            <div className="flex gap-2">
              <input
                id="callsign"
                type="text"
                className="field"
                placeholder={defaultCallsign('00000000')}
                maxLength={24}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
              />
              <button
                type="button"
                className={`btn shrink-0 ${SUPABASE_ENABLED ? '' : 'btn--primary'}`}
                onClick={() => void handleGuest()}
                disabled={busy}
              >
                Entrar
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
              Solo para desarrollo: pide un token al backend en modo development.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 border border-[rgba(244,63,94,0.4)] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-xs text-[#fda4af]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-4 border border-[rgba(103,232,249,0.35)] bg-[rgba(103,232,249,0.07)] px-3 py-2 text-xs text-[var(--color-signal)]">
            {notice}
          </p>
        ) : null}
      </Panel>

      <footer className="mt-5 flex items-center justify-center gap-2 text-[11px] text-[var(--color-ink-faint)]">
        <StatusDot on={health?.status === 'ok'} pulse />
        <span className="hud-sub">
          {healthError
            ? 'Servicio no disponible'
            : health
              ? `Servicio ${health.status} · ${health.rooms} salas · ${health.connections} conexiones`
              : 'Consultando servicio…'}
        </span>
        <span className="text-[var(--color-stroke-faint)]">·</span>
        <span className="font-mono">{REALTIME_URL}</span>
      </footer>
    </div>
  );
}
