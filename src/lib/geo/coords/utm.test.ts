import { bandLatRange, centralMeridian, utmZone, zoneLonRange } from './utm';

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
