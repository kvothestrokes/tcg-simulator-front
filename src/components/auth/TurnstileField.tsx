import { useEffect, useRef } from 'react';

import { TURNSTILE_SITE_KEY } from '../../lib/config';

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cb-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Turnstile.')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.dataset.cbTurnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Turnstile.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileFieldProps {
  onToken: (token: string | null) => void;
}

/** Widget invisible para el usuario hasta que Cloudflare lo pida. */
export function TurnstileField({ onToken }: TurnstileFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !hostRef.current) return;

    let widgetId: string | undefined;
    let cancelled = false;

    void loadTurnstile()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(hostRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => onToken(null));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={hostRef} className="mt-4" />;
}
