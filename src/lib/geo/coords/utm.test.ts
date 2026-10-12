import { centralMeridian, utmZone } from './utm';

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
