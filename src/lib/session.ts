/**
 * Sesión del jugador.
 *
 * Una sola fuente de identidad: el JWT de Supabase Auth (`sub`).
 *
 *   correo     magic link (producción y cuentas permanentes)
 *   invitado   signInAnonymously() — mismo rol `authenticated`, claim
 *              is_anonymous. El alias es solo presentación.
 *
 * REST y WebSocket consumen `getAccessToken()` sin saber cómo se obtuvo.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';

import {
  SUPABASE_ENABLED,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from './config';

export type IdentityKind = 'supabase' | 'anonymous';

export interface Identity {
  userId: string;
  label: string;
  kind: IdentityKind;
}

const CALLSIGN_KEY = 'cb:callsign';

let supabasePromise: Promise<SupabaseClient> | null = null;

/** Carga el cliente de Supabase solo si de verdad se va a usar. */
export async function supabase(): Promise<SupabaseClient> {
  if (!SUPABASE_ENABLED) {
    throw new Error('Supabase no está configurado (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_PUBLISHABLE_KEY).');
  }
  if (!supabasePromise) {
    supabasePromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    );
  }
  return supabasePromise;
}

function readCallsign(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(CALLSIGN_KEY);
  } catch {
    return null;
  }
}

function writeCallsign(label: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (label) localStorage.setItem(CALLSIGN_KEY, label);
    else localStorage.removeItem(CALLSIGN_KEY);
  } catch {
    // Modo incógnito: el alias dura lo que dure la pestaña.
  }
}

function identityFromUser(user: User): Identity {
  const kind: IdentityKind = user.is_anonymous ? 'anonymous' : 'supabase';
  const stored = readCallsign()?.trim();
  const email = user.email?.trim();
  const label = stored || email || defaultCallsign(user.id);
  return { userId: user.id, label, kind };
}

/** Access token vigente, o null si no hay sesión. */
export async function getAccessToken(): Promise<string | null> {
  if (!SUPABASE_ENABLED) return null;
  const client = await supabase();
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Identidad actual, o null si no hay sesión. */
export async function getIdentity(): Promise<Identity | null> {
  if (!SUPABASE_ENABLED) return null;
  const client = await supabase();
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  return identityFromUser(data.user);
}

export interface SignInOptions {
  captchaToken?: string;
}

/** Envía un magic link de Supabase al correo indicado. */
export async function signInWithEmail(
  email: string,
  redirectTo?: string,
  options: SignInOptions = {},
): Promise<void> {
  const client = await supabase();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        redirectTo ?? (typeof window !== 'undefined' ? `${window.location.origin}/lobby/` : undefined),
      captchaToken: options.captchaToken,
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Entra como invitado. Si ya hay sesión (anónima o permanente), la reutiliza
 * para no crear usuarios de más en Auth.
 */
export async function signInAsGuest(
  label?: string,
  options: SignInOptions = {},
): Promise<Identity> {
  if (!SUPABASE_ENABLED) {
    throw new Error('Supabase no está configurado: no se puede entrar como invitado.');
  }

  const trimmed = label?.trim();
  if (trimmed) writeCallsign(trimmed);

  const client = await supabase();
  const existing = await client.auth.getUser();
  if (existing.data.user) return identityFromUser(existing.data.user);

  const { data, error } = await client.auth.signInAnonymously({
    options: { captchaToken: options.captchaToken },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Supabase no devolvió un usuario anónimo.');
  return identityFromUser(data.user);
}

/** Cierra la sesión activa. */
export async function signOut(): Promise<void> {
  writeCallsign(null);
  if (!SUPABASE_ENABLED) return;
  const client = await supabase();
  await client.auth.signOut();
}

/** Avisa cuando cambia la sesión de Supabase (login, logout, refresco). */
export async function onAuthChange(callback: () => void): Promise<() => void> {
  if (!SUPABASE_ENABLED) return () => {};
  const client = await supabase();
  const { data } = client.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
}

/** Indicativo por defecto: los 4 primeros caracteres del id. */
export function defaultCallsign(userId: string): string {
  return `Piloto-${userId.slice(0, 4).toUpperCase()}`;
}

/** Nombre corto y estable para enseñar a partir de un id. */
export function shortName(userId: string | undefined | null): string {
  if (!userId) return '—';
  return userId.slice(0, 4).toUpperCase();
}
