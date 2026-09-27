/**
 * Room page entry: the game table, plus the offline test panel when the page
 * was opened with the `test` URL param (see lib/testMode.ts).
 *
 * Without the param this renders GameTable alone, exactly as before.
 */

import { useState } from 'react';

import { GameTable } from './GameTable';
import { TestModePanel } from './TestModePanel';
import { TEST_ROOM_CODE, isTestMode } from '@/lib/testMode';

export function RoomScreen() {
  // Runs before GameTable's first render, which reads `code` from the URL.
  const [testMode] = useState(() => {
    const active = isTestMode();
    if (active) forceTestRoomCode();
    return active;
  });

  return (
    <>
      <GameTable />
      {testMode ? <TestModePanel /> : null}
    </>
  );
}

/** Test mode always plays in the TEST room, so no real room's local data is touched. */
function forceTestRoomCode(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('code') === TEST_ROOM_CODE) return;
  url.searchParams.set('code', TEST_ROOM_CODE);
  window.history.replaceState(window.history.state, '', url);
}
