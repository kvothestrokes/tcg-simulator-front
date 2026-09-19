/**
 * Selected-deck persistence.
 *
 * The deck a player takes into a match is their "loadout". It is chosen in the
 * lobby before entering a room and stored locally (like the private hand, it is
 * a client-side choice and never travels to the server). Keyed per user so two
 * accounts on the same browser don't clobber each other.
 */

const KEY_PREFIX = 'cb:selected-deck:';

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** The deck id the user last chose as their match loadout, if any. */
export function getSelectedDeckId(userId: string | undefined): string | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

/** Persist (or clear, when deckId is null) the user's chosen loadout. */
export function setSelectedDeckId(userId: string | undefined, deckId: string | null): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    if (deckId) localStorage.setItem(key(userId), deckId);
    else localStorage.removeItem(key(userId));
  } catch {
    // No storage: the choice lasts only for this navigation.
  }
}
