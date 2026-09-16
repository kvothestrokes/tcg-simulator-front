import { describe, expect, it } from 'vitest';

import { defaultCallsign, shortName } from './session';

describe('presentación de identidad', () => {
  it('el alias corto sale del id, no de claims editables', () => {
    expect(defaultCallsign('a1b2c3d4-1111-4111-8111-111111111111')).toBe('Piloto-A1B2');
    expect(shortName('a1b2c3d4-1111-4111-8111-111111111111')).toBe('A1B2');
    expect(shortName(null)).toBe('—');
  });
});
