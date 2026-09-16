/**
 * Sesión del jugador para los componentes de React.
 */

import { useCallback, useEffect, useState } from 'react';

import { getIdentity, onAuthChange, signOut as doSignOut, type Identity } from '../lib/session';

export interface UseSessionResult {
  identity: Identity | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useSession(): UseSessionResult {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIdentity(await getIdentity());
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    let unsubscribe: (() => void) | undefined;
    void onAuthChange(() => void refresh()).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await doSignOut();
    setIdentity(null);
  }, []);

  return { identity, loading, refresh, signOut };
}
