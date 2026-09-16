/**
 * Configuración del cliente.
 *
 * Solo variables PUBLIC_*: todo lo que hay aquí acaba en el navegador. Los
 * secretos (JWT secret, service role key, DATABASE_URL) viven únicamente en el
 * servicio Go.
 */

function read(name: keyof ImportMetaEnv, fallback = ''): string {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

/** URL base del servicio de tiempo real, sin barra final. */
export const REALTIME_URL = read('PUBLIC_REALTIME_URL', 'http://localhost:8080').replace(/\/+$/, '');

/** Misma URL en esquema WebSocket: http -> ws, https -> wss. */
export const REALTIME_WS_URL = REALTIME_URL.replace(/^http/, 'ws');

export const SUPABASE_URL = read('PUBLIC_SUPABASE_URL');

/**
 * Clave pública de Supabase. Preferimos la publishable key actual; la anon
 * JWT-based se acepta todavía porque muchos proyectos no han rotado.
 */
export const SUPABASE_PUBLISHABLE_KEY =
  read('PUBLIC_SUPABASE_PUBLISHABLE_KEY') || read('PUBLIC_SUPABASE_ANON_KEY');

/** @deprecated Usa SUPABASE_PUBLISHABLE_KEY. Conservado para no romper imports. */
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

export const TURNSTILE_SITE_KEY = read('PUBLIC_TURNSTILE_SITE_KEY');

/** Hay Supabase configurado y utilizable. */
export const SUPABASE_ENABLED = SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== '';

/** Ruta de la sala. La app es estática, por eso el código va en la query. */
export function roomPath(code: string): string {
  return `/room/?code=${encodeURIComponent(code.toUpperCase())}`;
}

/** Enlace completo para compartir con el rival. */
export function roomShareUrl(code: string): string {
  if (typeof window === 'undefined') return roomPath(code);
  return new URL(roomPath(code), window.location.origin).toString();
}
