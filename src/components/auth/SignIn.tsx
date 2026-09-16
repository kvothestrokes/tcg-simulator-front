/**
 * Pantalla de acceso.
 *
 *   · Un clic como invitado (Supabase Anonymous Sign-Ins).
 *   · Magic link por correo, opcional.
 *   · Turnstile si hay site key (producción).
 *
 * Si llegas con ?next=/room/?code=…, tras entrar vuelves a esa sala.
 */

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import { Panel } from '../ui/Panel';
import { StatusDot } from '../ui/StatusDot';
import { Wordmark } from '../ui/Wordmark';
import { TurnstileField } from './TurnstileField';
import { useSession } from '../../hooks/useSession';
import { RealtimeApi, errorMessage, type HealthResponse } from '../../lib/api';
import {
  REALTIME_URL,
  SUPABASE_ENABLED,
  TURNSTILE_SITE_KEY,
} from '../../lib/config';
import { nextFromLocation, postLoginPath } from '../../lib/navigation';
import { defaultCallsign, signInAsGuest, signInWithEmail } from '../../lib/session';

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const destination = useMemo(() => postLoginPath(nextFromLocation()), []);

  useEffect(() => {
    if (!loading && identity) window.location.href = destination;
  }, [loading, identity, destination]);

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

  const requireCaptcha = Boolean(TURNSTILE_SITE_KEY);
  const captchaReady = !requireCaptcha || Boolean(captchaToken);

  const handleMagicLink = useCallback(
    async (event: SyntheticEvent) => {
      event.preventDefault();
      if (!captchaReady) {
        setError('Completa la verificación anti-bots antes de continuar.');
        return;
      }
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const origin = window.location.origin;
        await signInWithEmail(email.trim(), `${origin}${destination}`, {
          captchaToken: captchaToken ?? undefined,
        });
        setNotice('Te enviamos un enlace de acceso. Revisa tu correo.');
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [captchaReady, captchaToken, destination, email],
  );

  const handleGuest = useCallback(async () => {
    if (!captchaReady) {
      setError('Completa la verificación anti-bots antes de continuar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInAsGuest(callsign.trim() || undefined, {
        captchaToken: captchaToken ?? undefined,
      });
      window.location.href = destination;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }, [callsign, captchaReady, captchaToken, destination]);

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
        {!SUPABASE_ENABLED ? (
          <p className="mb-6 text-xs text-[var(--color-ink-faint)]">
            Configura <code className="text-[var(--color-ink-dim)]">PUBLIC_SUPABASE_URL</code> y{' '}
            <code className="text-[var(--color-ink-dim)]">PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> para
            poder entrar.
          </p>
        ) : (
          <>
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
                className="btn btn--primary shrink-0"
                onClick={() => void handleGuest()}
                disabled={busy || !captchaReady}
              >
                Entrar
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
              Sin correo. Conservas el asiento en este dispositivo hasta que cierres sesión.
            </p>

            <form onSubmit={handleMagicLink} className="scanline-top mt-6 pt-6">
              <label className="hud-sub mb-2 block" htmlFor="email">
                O entra con correo
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
                <button
                  type="submit"
                  className="btn shrink-0"
                  disabled={busy || !captchaReady}
                >
                  Enviar
                </button>
              </div>
            </form>

            <TurnstileField onToken={setCaptchaToken} />
          </>
        )}

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
