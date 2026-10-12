import { getMapboxToken } from './env';

describe('getMapboxToken', () => {
  it('returns a trimmed token', () => {
    expect(getMapboxToken('  pk.abc  ')).toBe('pk.abc');
  });

  it.each([[undefined], [''], ['   ']])('returns null for %p', (raw) => {
    expect(getMapboxToken(raw)).toBeNull();
  });
});
