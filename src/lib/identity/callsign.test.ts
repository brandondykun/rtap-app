import { CALLSIGN_MAX, normalizeCallsign } from './callsign';

describe('normalizeCallsign', () => {
  it('trims, capitalizes and collapses spaces', () => {
    expect(normalizeCallsign('  viper 6 ')).toBe('VIPER 6');
    expect(normalizeCallsign('red   one-1')).toBe('RED ONE-1');
  });

  it(`takes letters, digits, spaces and hyphens, up to ${CALLSIGN_MAX} characters`, () => {
    expect(normalizeCallsign('A'.repeat(CALLSIGN_MAX))).toBe('A'.repeat(CALLSIGN_MAX));
    expect(normalizeCallsign('A'.repeat(CALLSIGN_MAX + 1))).toBeNull();
    expect(normalizeCallsign('VIPER_6')).toBeNull();
    expect(normalizeCallsign('VIPER!')).toBeNull();
    expect(normalizeCallsign('ÉCLAIR')).toBeNull();
  });

  it('needs a letter or digit first, and is not empty', () => {
    expect(normalizeCallsign('')).toBeNull();
    expect(normalizeCallsign('   ')).toBeNull();
    expect(normalizeCallsign('-VIPER')).toBeNull();
  });
});
