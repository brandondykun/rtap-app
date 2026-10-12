import { declination } from '@/lib/geo/north/magnetic';

import { angularDistance, shouldEmitHeading, trueHeadingFrom } from './heading';

const DC = { lat: 38.8977, lon: -77.0365 };
const DATE = new Date('2026-06-01T00:00:00Z');

describe('trueHeadingFrom', () => {
  it('uses the true heading when the device provides it', () => {
    expect(trueHeadingFrom({ trueHeading: 370, magHeading: 5 }, DC, DATE, null)).toBe(10);
  });

  it('converts magnetic heading with the model when true heading is unavailable', () => {
    const h = trueHeadingFrom({ trueHeading: -1, magHeading: 100 }, DC, DATE, null);
    expect(h).toBeCloseTo(100 + declination(DC, DATE), 6);
  });

  it('honours the declination override', () => {
    expect(trueHeadingFrom({ trueHeading: -1, magHeading: 100 }, DC, DATE, 10)).toBeCloseTo(110, 6);
  });

  it.each([
    [{ trueHeading: -1, magHeading: -1 }, DC],
    [{ trueHeading: -1, magHeading: 100 }, null],
    [{ trueHeading: Number.NaN, magHeading: Number.NaN }, DC],
  ])('returns null when no heading is usable (%p)', (event, position) => {
    expect(trueHeadingFrom(event, position, DATE, null)).toBeNull();
  });
});

describe('heading throttle', () => {
  it('measures the short way round north', () => {
    expect(angularDistance(359, 1)).toBe(2);
    expect(angularDistance(1, 359)).toBe(2);
    expect(angularDistance(90, 270)).toBe(180);
  });

  it('always emits the first sample', () => {
    expect(shouldEmitHeading(null, 10, 0)).toBe(true);
  });

  it('drops samples that are too soon or too small', () => {
    expect(shouldEmitHeading({ heading: 10, at: 0 }, 30, 50)).toBe(false);
    expect(shouldEmitHeading({ heading: 10, at: 0 }, 11, 500)).toBe(false);
  });

  it('emits a 2° change across north', () => {
    expect(shouldEmitHeading({ heading: 359, at: 0 }, 1, 200)).toBe(true);
  });
});
