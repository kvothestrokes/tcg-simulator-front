/**
 * Sesión del jugador.
 *
 * Dos vías, con la misma interfaz para el resto de la app:
 *
 *   supabase  Supabase Auth (magic link). Es la de producción.
 *   dev       JWT emitido por POST /v1/dev/token del backend, que solo existe
 *             con APP_ENV=development. Permite trabajar en el juego sin montar
 *             Supabase todavía.
 *
 * Todo lo demás (REST y WebSocket) consume `getAccessToken()` sin saber de
 * dónde sale el token.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { DEV_AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_ENABLED, SUPABASE_URL } from './config';
import { RealtimeApi } from './api';

export type IdentityKind = 'supabase' | 'dev';

export interface Identity {
  userId: string;
  label: string;
  kind: IdentityKind;
}

const DEV_STORAGE_KEY = 'cb:dev-session';
/** Margen para renovar antes de que el token caduque de verdad. */
const REFRESH_MARGIN_MS = 60_000;

interface DevSession {
  userId: string;
  token: string;
  expiresAt: number;
  label: string;
}

// --- Supabase ----------------------------------------------------------------

let supabasePromise: Promise<SupabaseClient> | null = null;

/** Carga el cliente de Supabase solo si de verdad se va a usar. */
async function supabase(): Promise<SupabaseClient> {
  if (!SUPABASE_ENABLED) {
    throw new Error('Supabase no está configurado (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).');
  }
  if (!supabasePromise) {
    supabasePromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    );
  }
  return supabasePromise;
}

// --- almacenamiento de la sesión de desarrollo -------------------------------

function readDevSession(): DevSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevSession;
    if (!parsed?.token || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDevSession(session: DevSession | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (session) localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(DEV_STORAGE_KEY);
  } catch {
    // Modo incógnito: la sesión durará solo lo que dure la pestaña.
  }
}

// --- API pública -------------------------------------------------------------

/**
 * Devuelve un access token válido, renovándolo si hace falta.
 *
 * Es la función que se pasa al cliente REST y al WebSocket; se llama en cada
 * conexión y en cada renovación.
 */
export async function getAccessToken(): Promise<string | null> {
  const dev = readDevSession();
  if (dev) {
    if (dev.expiresAt - Date.now() > REFRESH_MARGIN_MS) return dev.token;
    // Token de desarrollo a punto de caducar: se pide otro para el mismo id.
    try {
      const refreshed = await devSignIn(dev.label, dev.userId);
      return refreshed.token;
    } catch {
      return dev.token; // que falle arriba con un error claro
    }
  }

  if (!SUPABASE_ENABLED) return null;
  const client = await supabase();
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Identidad actual, o null si no hay sesión. */
export async function getIdentity(): Promise<Identity | null> {
  const dev = readDevSession();
  if (dev) return { userId: dev.userId, label: dev.label, kind: 'dev' };

  if (!SUPABASE_ENABLED) return null;
  const client = await supabase();
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  return {
    userId: data.user.id,
    label: data.user.email ?? 'Piloto',
    kind: 'supabase',
  };
}

/** Envía un magic link de Supabase al correo indicado. */
export async function signInWithEmail(email: string, redirectTo?: string): Promise<void> {
  const client = await supabase();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        redirectTo ?? (typeof window !== 'undefined' ? `${window.location.origin}/lobby/` : undefined),
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Entra como invitado pidiendo un JWT al backend.
 *
 * Solo funciona con el backend en modo desarrollo. Reutiliza el userId anterior
 * si existe, para que al recargar sigas siendo el mismo jugador de la sala.
 */
export async function devSignIn(label?: string, userId?: string): Promise<Identity & { token: string }> {
  if (!DEV_AUTH_ENABLED) {
    throw new Error('El modo invitado está desactivado (PUBLIC_DEV_AUTH).');
  }

  const previous = readDevSession();
  const api = new RealtimeApi(async () => null);
  const issued = await api.devToken(userId ?? previous?.userId);

  const session: DevSession = {
    userId: issued.userId,
    token: issued.token,
    expiresAt: new Date(issued.expiresAt).getTime(),
    label: label ?? previous?.label ?? defaultCallsign(issued.userId),
  };
  writeDevSession(session);

  return { userId: session.userId, label: session.label, kind: 'dev', token: session.token };
}

/** Cierra la sesión activa, sea del tipo que sea. */
export async function signOut(): Promise<void> {
  if (readDevSession()) {
    writeDevSession(null);
    return;
  }
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
