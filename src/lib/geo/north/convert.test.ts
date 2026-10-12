import { fromTrue, gridMagneticAngle, northOffset, toTrue } from './convert';
import { gridConvergence } from './grid';

const DC = { lat: 38.8977, lon: -77.0365 };
const EAST = { lat: 45, lon: -73 }; // convergence ≈ +1.41°
const date = new Date(Date.UTC(2026, 5, 1));

describe('northOffset', () => {
  it('is zero for true north', () => {
    expect(northOffset('true', DC, { date })).toBe(0);
  });

  it('uses grid convergence for grid north', () => {
    expect(northOffset('grid', DC, { date })).toBeCloseTo(gridConvergence(DC), 10);
  });

  it('prefers a declination override for magnetic north', () => {
    expect(northOffset('magnetic', DC, { date, declinationOverrideDeg: 10 })).toBe(10);
  });

  it('computes declination when there is no override', () => {
    expect(northOffset('magnetic', DC, { date, declinationOverrideDeg: null })).toBeLessThan(-9);
  });
});

describe('fromTrue / toTrue', () => {
  it('wraps across north instead of going negative', () => {
    expect(fromTrue(1, 'grid', EAST, { date })).toBeCloseTo(359.5855, 3);
  });

  it('subtracts an east declination', () => {
    expect(fromTrue(5, 'magnetic', DC, { date, declinationOverrideDeg: 10 })).toBeCloseTo(355, 10);
  });

  it('round-trips', () => {
    for (const ref of ['true', 'grid', 'magnetic'] as const) {
      const ctx = { date, declinationOverrideDeg: 7.5 };
      expect(toTrue(fromTrue(123.4, ref, DC, ctx), ref, DC, ctx)).toBeCloseTo(123.4, 10);
    }
  });
});

describe('gridMagneticAngle', () => {
  it('is declination minus convergence', () => {
    const ctx = { date, declinationOverrideDeg: 10 };
    expect(gridMagneticAngle(DC, ctx)).toBeCloseTo(10 - gridConvergence(DC), 10);
  });
});
