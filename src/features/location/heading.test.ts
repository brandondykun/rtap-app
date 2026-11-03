import { declination } from '@/lib/geo/north/magnetic';

import { angularDistance, screenHeadingOffset, shouldEmitHeading, smoothHeading, trueHeadingFrom } from './heading';

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
    expect(shouldEmitHeading({ heading: 10, at: 0 }, 10.5, 500)).toBe(false);
  });

  it('emits a 2° change across north', () => {
    expect(shouldEmitHeading({ heading: 359, at: 0 }, 1, 200)).toBe(true);
  });
});

describe('smoothHeading', () => {
  it('starts at the first reading', () => {
    expect(smoothHeading(null, 370, 0)).toEqual({ heading: 10, at: 0 });
  });

  it('holds steady through the few-degree wobble of a compass at rest', () => {
    // A phone lying still: readings wobble ±3° around 90° about ten times a second.
    let s = smoothHeading(null, 90, 0);
    const shown: number[] = [];
    [93, 87, 92, 88, 93, 87, 92, 88].forEach((reading, i) => {
      s = smoothHeading(s, reading, (i + 1) * 100);
      shown.push(s.heading);
    });
    for (const h of shown) expect(Math.abs(h - 90)).toBeLessThan(1.5);
  });

  it('follows a real turn almost at once', () => {
    const s = smoothHeading({ heading: 0, at: 0 }, 90, 100);
    expect(s.heading).toBeGreaterThan(70);
  });

  it('goes the short way round north', () => {
    const s = smoothHeading({ heading: 355, at: 0 }, 5, 100);
    // Toward 5° through 0°, not back round through 180°.
    expect(angularDistance(s.heading, 0)).toBeLessThan(5);
  });

  it('catches up with the compass after a pause in readings', () => {
    expect(smoothHeading({ heading: 40, at: 0 }, 50, 5000).heading).toBeCloseTo(50, 1);
  });
});

describe('screenHeadingOffset', () => {
  it.each([
    ['portrait-up', 0],
    ['landscape-right', 90],
    ['portrait-down', 180],
    ['landscape-left', 270],
    ['unknown', 0],
  ] as const)('%s → %i°', (orientation, offset) => {
    expect(screenHeadingOffset(orientation)).toBe(offset);
  });
});
