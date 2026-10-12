import { gridConvergence } from './grid';

describe('gridConvergence', () => {
  it('is zero on the central meridian', () => {
    expect(gridConvergence({ lat: 45, lon: -75 })).toBeCloseTo(0, 10);
  });

  it('is negative west of the central meridian in the northern hemisphere (Washington, DC)', () => {
    expect(gridConvergence({ lat: 38.8977, lon: -77.0365 })).toBeCloseTo(-1.2791, 3);
  });

  it('is positive east of the central meridian in the northern hemisphere', () => {
    expect(gridConvergence({ lat: 45, lon: -73 })).toBeCloseTo(1.4145, 3);
  });

  it('flips sign in the southern hemisphere (Cape Town, zone 34)', () => {
    expect(gridConvergence({ lat: -33.9, lon: 18.4 })).toBeCloseTo(1.4508, 3);
  });

  it('is zero on the equator', () => {
    expect(gridConvergence({ lat: 0, lon: -72 })).toBeCloseTo(0, 10);
  });
});
