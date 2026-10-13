import { formatLength } from './gps-format';

describe('formatLength', () => {
  it.each([
    [142.4, 'm', '142 m'],
    [142.4, 'ft', '467 ft'],
    [-12.6, 'm', '-13 m'],
    [0, 'ft', '0 ft'],
    [null, 'm', '—'],
    [undefined, 'ft', '—'],
    [Number.NaN, 'm', '—'],
  ] as const)('%p %s → %s', (meters, unit, expected) => {
    expect(formatLength(meters, unit)).toBe(expected);
  });
});
