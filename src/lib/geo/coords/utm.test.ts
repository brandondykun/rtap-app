import * as mgrs from 'mgrs';

import { bandLatRange, centralMeridian, fromUtm, toUtm, utmZone, zoneLonRange } from './utm';

describe('utmZone', () => {
  it.each([
    [38.9, -77, 18],
    [0, 0, 31],
    [0, -0.0001, 30],
    [0, 179.9, 60],
    [0, 180, 1],
    [57, 3.5, 32], // Norway exception
    [60.5, 10.5, 32],
    [78, 8, 31], // Svalbard exceptions
    [78, 10, 33],
    [78, 15, 33],
    [78, 25, 35],
    [78, 35, 37],
  ])('(%p, %p) → zone %p', (lat, lon, zone) => {
    expect(utmZone({ lat, lon })).toBe(zone);
  });
});

describe('centralMeridian', () => {
  it.each([
    [1, -177],
    [18, -75],
    [31, 3],
    [60, 177],
  ])('zone %p → %p°', (zone, cm) => {
    expect(centralMeridian(zone)).toBe(cm);
  });
});

describe('bandLatRange', () => {
  it.each([
    ['C', [-80, -72]],
    ['N', [0, 8]],
    ['T', [40, 48]],
    ['W', [64, 72]],
    ['X', [72, 84]],
  ])('band %p → %p', (band, range) => {
    expect(bandLatRange(band)).toEqual(range);
  });

  it.each(['I', 'O', 'A', 'B', 'Y', 'Z', '', 'NN'])('rejects %p', (band) => {
    expect(bandLatRange(band)).toBeNull();
  });
});

describe('zoneLonRange', () => {
  it.each([
    [18, 'S', [-78, -72]],
    [1, 'C', [-180, -174]],
    [60, 'X', [174, 180]],
    [31, 'V', [0, 3]],
    [32, 'V', [3, 12]],
    [31, 'X', [0, 9]],
    [33, 'X', [9, 21]],
    [35, 'X', [21, 33]],
    [37, 'X', [33, 42]],
    [33, 'V', [12, 18]],
  ])('zone %p band %p → %p', (zone, band, range) => {
    expect(zoneLonRange(zone, band)).toEqual(range);
  });

  it.each([
    [32, 'X'],
    [34, 'X'],
    [36, 'X'],
    [0, 'S'],
    [61, 'S'],
  ])('zone %p band %p does not exist', (zone, band) => {
    expect(zoneLonRange(zone, band)).toBeNull();
  });
});

describe('toUtm / fromUtm', () => {
  it.each([
    [38.8977, -77.0365],
    [-33.86, 151.21],
    [64.1, -21.9],
    [0.5, 2.9],
  ])('agrees with the MGRS library at (%p, %p)', (lat, lon) => {
    const zone = utmZone({ lat, lon });
    const { easting, northing } = toUtm({ lat, lon }, zone);
    // The library's 1 m reference truncates; its last five digits are the easting and northing within the square.
    const ref = mgrs.forward([lon, lat], 5);
    expect(Math.floor(easting) % 100_000).toBe(Number(ref.slice(-10, -5)));
    expect(Math.floor(northing) % 100_000).toBe(Number(ref.slice(-5)));
  });

  it('puts the southern hemisphere 10,000 km north, so northings stay positive', () => {
    expect(toUtm({ lat: -0.001, lon: 3 }, 31).northing).toBeCloseTo(10_000_000 - 110.6, 0);
    expect(toUtm({ lat: 0.001, lon: 3 }, 31).northing).toBeCloseTo(110.6, 0);
  });

  it('measures from a given zone, even a neighbour (so a zone grid can be drawn up to its edge)', () => {
    expect(toUtm({ lat: 0, lon: 3 }, 31).easting).toBeCloseTo(500_000, 3);
    expect(toUtm({ lat: 0, lon: 3 }, 30).easting).toBeGreaterThan(1_000_000);
  });

  it.each([
    [38.8977, -77.0365, 18],
    [-45.5, 170.2, 59],
    [60.5, 4.5, 32],
  ])('round-trips (%p, %p) in zone %p to within a few centimetres', (lat, lon, zone) => {
    const back = fromUtm(toUtm({ lat, lon }, zone), zone, lat < 0);
    expect(back.lat).toBeCloseTo(lat, 6);
    expect(back.lon).toBeCloseTo(lon, 6);
  });
});
