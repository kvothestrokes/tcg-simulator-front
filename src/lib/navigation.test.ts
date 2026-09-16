import { describe, expect, it } from 'vitest';

import { loginPath, postLoginPath, safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it('acepta el hangar y una sala con código válido', () => {
    expect(safeNextPath('/lobby/')).toBe('/lobby/');
    expect(safeNextPath('/lobby')).toBe('/lobby/');
    expect(safeNextPath('/lobby/?code=abc123')).toBe('/lobby/?code=ABC123');
    expect(safeNextPath('/room/?code=AB2C3D')).toBe('/room/?code=AB2C3D');
  });

  it('rechaza redirecciones abiertas y códigos inválidos', () => {
    expect(safeNextPath('https://evil.example/lobby/')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/room/?code=../x')).toBeNull();
    expect(safeNextPath('/room/')).toBeNull();
    expect(safeNextPath('/admin/')).toBeNull();
    expect(safeNextPath('/room/?code=ABC123#steal')).toBeNull();
  });
});

describe('postLoginPath / loginPath', () => {
  it('cae al hangar si next no es interno', () => {
    expect(postLoginPath('https://evil.example')).toBe('/lobby/');
    expect(loginPath('/room/?code=NEON01')).toBe('/?next=%2Froom%2F%3Fcode%3DNEON01');
    expect(loginPath('https://evil.example')).toBe('/');
  });
});
