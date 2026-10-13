import { formatCategoryCounts, formatLastOpened } from './format';

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const MIN = 60_000;

describe('formatLastOpened', () => {
  it.each([
    [null, 'Never opened'],
    [NOW - 30_000, 'Opened just now'],
    [NOW + 5 * MIN, 'Opened just now'], // clock skew: future timestamps never go negative
    [NOW - 5 * MIN, 'Opened 5 min ago'],
    [NOW - 3 * 60 * MIN, 'Opened 3 h ago'],
    [NOW - 2 * 24 * 60 * MIN, 'Opened 2 d ago'],
    [Date.UTC(2026, 8, 1, 8, 0, 0), 'Opened 2026-09-01'],
  ])('%p → %p', (ts, expected) => {
    expect(formatLastOpened(ts, NOW)).toBe(expected);
  });
});

describe('formatCategoryCounts', () => {
  it('names both parts with singular and plural', () => {
    expect(formatCategoryCounts({ units: 2, points: 0 })).toBe('2 units · 0 points');
    expect(formatCategoryCounts({ units: 1, points: 1 }, ' and ')).toBe('1 unit and 1 point');
  });
});
