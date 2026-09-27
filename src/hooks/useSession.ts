/**
 * Sesión del jugador para los componentes de React.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { getIdentity, onAuthChange, signOut as doSignOut, type Identity } from '../lib/session';
import { getTestActor, isTestMode, subscribeTestActor, testIdentity } from '../lib/testMode';

export interface UseSessionResult {
  identity: Identity | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useSession(): UseSessionResult {
  // Fixed for the page's lifetime: the URL decides it once.
  const [testMode] = useState(isTestMode);
  const real = useRealSession(!testMode);
  const actor = useSyncExternalStore(subscribeTestActor, getTestActor, () => 'me' as const);
  const fake = useMemo<UseSessionResult>(
    () => ({ identity: testIdentity(actor), loading: false, refresh: noop, signOut: noop }),
    [actor],
  );
  // Offline test mode: a fake seat, no Supabase (see lib/testMode.ts).
  return testMode ? fake : real;
}

const noop = async () => {};

function useRealSession(enabled: boolean): UseSessionResult {
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
    if (!enabled) return;
    void refresh();
    let unsubscribe: (() => void) | undefined;
    void onAuthChange(() => void refresh()).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, [enabled, refresh]);

  const signOut = useCallback(async () => {
    await doSignOut();
    setIdentity(null);
  }, []);

  return { identity, loading, refresh, signOut };
}
