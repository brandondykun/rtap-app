import { toMgrs } from '@/lib/geo/coords/mgrs';
import { formatLatLon, formatMgrs } from '@/lib/geo/format/coords';
import { describeVector } from '@/lib/geo/vector';

import { describeReadout, formatCoordinate, type ReadoutSettings } from './readout';

const DC = { lat: 38.8977, lon: -77.0365 };
const NEAR = { lat: 38.905, lon: -77.03 };
const DATE = new Date('2026-06-01T00:00:00Z');
const SETTINGS: ReadoutSettings = { coordinateFormat: 'mgrs', angleUnit: 'deg', northRef: 'grid', declinationOverrideDeg: null };

describe('formatCoordinate', () => {
  it('formats MGRS with spaces', () => {
    const m = toMgrs(DC, 5);
    if (!m.ok) throw new Error('setup');
    expect(formatCoordinate(DC, 'mgrs')).toBe(formatMgrs(m.value));
  });

  it('formats lat/lon when selected', () => {
    expect(formatCoordinate(DC, 'latlon')).toBe(formatLatLon(DC));
  });

  it('falls back to lat/lon outside MGRS coverage', () => {
    const polar = { lat: 85, lon: 10 };
    expect(formatCoordinate(polar, 'mgrs')).toBe(formatLatLon(polar));
  });
});

describe('describeReadout', () => {
  it('shows dashes before the map reports a center', () => {
    expect(describeReadout(null, DC, SETTINGS, DATE)).toEqual({ coordinate: '—', distance: '—', bearing: '—', ref: 'GRID' });
  });

  it('shows the crosshair coordinate but no range without a fix', () => {
    expect(describeReadout(NEAR, null, SETTINGS, DATE)).toEqual({
      coordinate: formatCoordinate(NEAR, 'mgrs'),
      distance: '—',
      bearing: '—',
      ref: 'GRID',
    });
  });

  it('describes range and bearing from the user to the crosshair', () => {
    const v = describeVector(DC, NEAR, { date: DATE, declinationOverrideDeg: null, unit: 'deg', ref: 'grid' });
    expect(describeReadout(NEAR, DC, SETTINGS, DATE)).toMatchObject({ distance: v.distanceLabel, bearing: v.bearingLabel });
  });

  it('honours unit and north reference', () => {
    const r = describeReadout(NEAR, DC, { ...SETTINGS, angleUnit: 'mil', northRef: 'magnetic' }, DATE);
    expect(r.bearing).toMatch(/^\d{4} mils$/);
    expect(r.ref).toBe('MAG');
  });
});
