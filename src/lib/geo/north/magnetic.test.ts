import { declination } from './magnetic';

/** Decimal year → Date, matching the WMM test-value convention. */
function decimalYear(year: number): Date {
  const whole = Math.floor(year);
  const start = Date.UTC(whole, 0, 1);
  return new Date(start + (year - whole) * 365 * 24 * 3600 * 1000);
}

describe('declination (WMM2025)', () => {
  it.each([
    [2025.0, 28, 89, -121, -99.77],
    [2025.0, 65, 43, 93, 0.5],
    [2025.0, 51, -33, 109, -5.49],
    [2025.5, 6, -36, -137, 20.28],
    [2025.5, 63, 26, 81, 0.51],
  ])('%p alt %p km (%p, %p) → %p°', (year, altKm, lat, lon, decl) => {
    expect(declination({ lat, lon }, decimalYear(year), altKm)).toBeCloseTo(decl, 1);
  });

  it('does not throw for dates outside the model window', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const d = declination({ lat: 38.9, lon: -77 }, new Date(Date.UTC(2035, 0, 1)));
    spy.mockRestore();
    expect(Number.isFinite(d)).toBe(true);
  });
});

describe('invalid date', () => {
  it('does not throw for an Invalid Date', () => {
    expect(Number.isFinite(declination({ lat: 38.9, lon: -77 }, new Date('nope')))).toBe(true);
  });
});
