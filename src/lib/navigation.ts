/**
 * Rutas internas post-login. Nada de este módulo acepta URLs absolutas:
 * un `next` abierto sería un vector de phishing (open redirect).
 */

const ROOM_CODE = /^[A-Z0-9]{4,12}$/i;

function parseRelative(raw: string): URL | null {
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/[\r\n\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, 'https://cb.invalid');
    if (url.origin !== 'https://cb.invalid') return null;
    if (url.username || url.password || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function normalizeCode(code: string | null): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  return ROOM_CODE.test(trimmed) ? trimmed : null;
}

/** Devuelve una ruta interna segura, o null si `raw` no es de esta app. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }

  const url = parseRelative(decoded);
  if (!url) return null;

  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  const code = normalizeCode(url.searchParams.get('code'));

  if (path === '/lobby/') {
    return code ? `/lobby/?code=${code}` : '/lobby/';
  }
  if (path === '/room/') {
    return code ? `/room/?code=${code}` : null;
  }
  return null;
}

/** Destino tras autenticarse: `next` validado, o el hangar. */
export function postLoginPath(raw: string | null | undefined): string {
  return safeNextPath(raw) ?? '/lobby/';
}

/** Pantalla de acceso, opcionalmente con retorno a una ruta interna. */
export function loginPath(next?: string | null): string {
  const safe = safeNextPath(next);
  if (!safe) return '/';
  return `/?next=${encodeURIComponent(safe)}`;
}

/** Lee `next` de la query de la página actual. */
export function nextFromLocation(search = typeof window !== 'undefined' ? window.location.search : ''): string | null {
  return new URLSearchParams(search).get('next');
}
