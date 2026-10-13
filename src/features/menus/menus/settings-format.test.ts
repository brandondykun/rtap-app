import { formatEastWest, formatEastWestBoth } from './settings-format';

describe('formatEastWest', () => {
  it.each([
    [10.64, 'deg', '10.6° E'],
    [-10.64, 'deg', '10.6° W'],
    [0, 'deg', '0.0° E'],
    [10, 'mil', '178 mils E'],
    [-10, 'mil', '178 mils W'],
    [null, 'deg', '—'],
    [Number.NaN, 'mil', '—'],
  ] as const)('%p %s → %s', (deg, unit, expected) => {
    expect(formatEastWest(deg, unit)).toBe(expected);
  });
});

describe('formatEastWestBoth', () => {
  it('shows degrees and mils', () => {
    expect(formatEastWestBoth(-10.64)).toBe('10.6° W · 189 mils W');
    expect(formatEastWestBoth(null)).toBe('—');
  });
});
