import { MILS_PER_CIRCLE, degToMils, milsToDeg, normalizeDeg, wrapLon } from './angle';

describe('normalizeDeg', () => {
  it.each([
    [0, 0],
    [360, 0],
    [-1, 359],
    [725, 5],
    [359.5, 359.5],
    [-360, 0],
  ])('%p → %p', (input, expected) => {
    expect(normalizeDeg(input)).toBeCloseTo(expected, 10);
  });

  it('never returns -0', () => {
    expect(Object.is(normalizeDeg(-0), 0)).toBe(true);
    expect(Object.is(normalizeDeg(-360), 0)).toBe(true);
  });
});

describe('degToMils (NATO 6400)', () => {
  it('uses 6400 mils per circle', () => {
    expect(MILS_PER_CIRCLE).toBe(6400);
  });

  it.each([
    [0, 0],
    [90, 1600],
    [180, 3200],
    [270, 4800],
    [360, 0],
    [-90, 4800],
    [103, 1831.111],
  ])('%p° → %p mils', (deg, mils) => {
    expect(degToMils(deg)).toBeCloseTo(mils, 3);
  });

  it('stays below 6400 for values just under a full circle', () => {
    expect(degToMils(359.9999999)).toBeLessThan(6400);
  });
});

describe('milsToDeg', () => {
  it.each([
    [1600, 90],
    [3200, 180],
    [6400, 0],
    [-1600, 270],
  ])('%p mils → %p°', (mils, deg) => {
    expect(milsToDeg(mils)).toBeCloseTo(deg, 10);
  });
});

describe('wrapLon', () => {
  it.each([
    [0, 0],
    [180, -180],
    [-180, -180],
    [190, -170],
    [-190, 170],
  ])('%p → %p', (input, expected) => {
    expect(wrapLon(input)).toBeCloseTo(expected, 10);
  });
});
