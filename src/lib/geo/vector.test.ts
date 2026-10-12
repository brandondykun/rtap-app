import { destination } from './measure/geodesic';
import { describeVector } from './vector';

const DC = { lat: 38.8977, lon: -77.0365 };
const target = destination(DC, 103, 1150);
const date = new Date(Date.UTC(2026, 5, 1));

describe('describeVector', () => {
  it('reports true bearing and distance', () => {
    const v = describeVector(DC, target, { unit: 'deg', ref: 'true', date });
    expect(v.distanceM).toBeCloseTo(1150, 3);
    expect(v.bearingDeg).toBeCloseTo(103, 6);
    expect(v.distanceLabel).toBe('1.15 km');
    expect(v.bearingLabel).toBe('103°');
    expect(v.refLabel).toBe('TRUE');
  });

  it('applies grid convergence at the origin', () => {
    const v = describeVector(DC, target, { unit: 'deg', ref: 'grid', date });
    expect(v.bearingDeg).toBeCloseTo(104.2791, 3);
    expect(v.bearingLabel).toBe('104°');
    expect(v.refLabel).toBe('GRID');
  });

  it('formats mils', () => {
    const v = describeVector(DC, target, { unit: 'mil', ref: 'grid', date });
    expect(v.bearingLabel).toBe('1854 mils');
  });

  it('applies a declination override', () => {
    const v = describeVector(DC, target, { unit: 'deg', ref: 'magnetic', date, declinationOverrideDeg: 10 });
    expect(v.bearingLabel).toBe('093°');
    expect(v.refLabel).toBe('MAG');
  });

  it('has no bearing when standing on the target', () => {
    const v = describeVector(DC, DC, { unit: 'deg', ref: 'grid', date });
    expect(v.distanceM).toBe(0);
    expect(v.bearingDeg).toBeNull();
    expect(v.bearingLabel).toBe('—');
    expect(v.distanceLabel).toBe('0 m');
  });
});
