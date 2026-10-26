import { fromTrue, gmConversion, gridMagneticAngle, northOffset, toTrue } from './convert';
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

// FM 3-25.26 (Map Reading and Land Navigation), the declination diagram notes: with magnetic north west of grid
// north, grid to magnetic adds the G-M angle and magnetic to grid subtracts it; east of grid north, the reverse.
describe('gmConversion', () => {
  it('adds grid to magnetic and subtracts magnetic to grid when magnetic north is west of grid north', () => {
    expect(gmConversion(-9.6)).toEqual({ gridToMagnetic: 'add', magneticToGrid: 'subtract' });
  });

  it('subtracts grid to magnetic and adds magnetic to grid when magnetic north is east of grid north', () => {
    expect(gmConversion(14.2)).toEqual({ gridToMagnetic: 'subtract', magneticToGrid: 'add' });
  });

  it('has nothing to do when grid and magnetic north agree, or the angle is unknown', () => {
    expect(gmConversion(0)).toBeNull();
    expect(gmConversion(NaN)).toBeNull();
  });

  it('agrees with converting a grid azimuth through true north', () => {
    for (const declinationOverrideDeg of [-12, 12]) {
      const ctx = { date, declinationOverrideDeg };
      const gm = gridMagneticAngle(DC, ctx);
      const grid = 100;
      const magnetic = fromTrue(toTrue(grid, 'grid', DC, ctx), 'magnetic', DC, ctx);
      const rule = gmConversion(gm);
      expect(rule).not.toBeNull();
      const applied = rule?.gridToMagnetic === 'add' ? grid + Math.abs(gm) : grid - Math.abs(gm);
      expect(applied).toBeCloseTo(magnetic, 9);
    }
  });
});

describe('non-finite declination override', () => {
  it('is treated as absent', () => {
    const modelled = northOffset('magnetic', DC, { date, declinationOverrideDeg: null });
    expect(northOffset('magnetic', DC, { date, declinationOverrideDeg: NaN })).toBe(modelled);
  });
});
