import type { SelfPosition } from '@/stores/presence';

import {
  type AverageSample,
  estimateAccuracyM,
  isOnSpot,
  isOutlier,
  sampleFromFix,
  spreadM,
  trimFrom,
  weightedCenter,
} from './gps-average-math';

const BASE = { lat: 38.8977, lon: -77.0365 };
const M_PER_DEG_LAT = 111_320;

/** A sample `northM` meters north of BASE. */
function at(northM: number, accuracyM: number, atMs: number, altitudeM: number | null = null): AverageSample {
  return { lat: BASE.lat + northM / M_PER_DEG_LAT, lon: BASE.lon, altitudeM, accuracyM, at: atMs };
}

/** `count` identical samples at BASE spread evenly over `durationS` seconds. */
function steady(count: number, accuracyM: number, durationS: number): AverageSample[] {
  return Array.from({ length: count }, (_, i) => at(0, accuracyM, (i * durationS * 1000) / (count - 1)));
}

describe('sampleFromFix', () => {
  const fix = (accuracyM: number | null): SelfPosition => ({
    position: BASE,
    accuracyM,
    timestamp: 1234,
    altitudeM: 55,
  });

  it('rejects fixes with no accuracy or worse than 30 m', () => {
    expect(sampleFromFix(fix(null))).toBeNull();
    expect(sampleFromFix(fix(31))).toBeNull();
    expect(sampleFromFix(fix(5))).toEqual({ lat: BASE.lat, lon: BASE.lon, altitudeM: 55, accuracyM: 5, at: 1234 });
  });
});

describe('weightedCenter', () => {
  it('leans toward the more accurate fixes', () => {
    const c = weightedCenter([at(0, 2, 0), at(10, 8, 1000)]);
    expect(c).not.toBeNull();
    expect(Math.abs((c!.position.lat - BASE.lat) * M_PER_DEG_LAT)).toBeLessThan(1);
  });

  it('is null for no samples and averages altitude over the samples that have one', () => {
    expect(weightedCenter([])).toBeNull();
    expect(weightedCenter([at(0, 5, 0, 100), at(0, 5, 1000)])!.altitudeM).toBeCloseTo(100, 6);
    expect(weightedCenter([at(0, 5, 0)])!.altitudeM).toBeNull();
  });
});

describe('estimateAccuracyM', () => {
  it('never goes below 2 m', () => {
    expect(estimateAccuracyM(steady(300, 3, 600))).toBe(2);
  });

  it('shrinks with minutes, not fix count', () => {
    expect(estimateAccuracyM(steady(60, 6, 60))).toBeCloseTo(6, 1);
    expect(estimateAccuracyM(steady(60, 6, 240))).toBeCloseTo(3, 1);
  });

  it('is never tighter than the spread', () => {
    const scattered = Array.from({ length: 20 }, (_, i) => at(i % 2 === 0 ? 8 : -8, 3, i * 1000));
    expect(spreadM(scattered)).toBeGreaterThan(7);
    expect(estimateAccuracyM(scattered)).toBeGreaterThanOrEqual(8 * 0.9);
  });
});

describe('isOutlier', () => {
  it('ignores the first four samples, then rejects a fix far outside', () => {
    const four = steady(4, 4, 3);
    expect(isOutlier(four, at(40, 4, 5000))).toBe(false);
    const five = steady(5, 4, 4);
    expect(isOutlier(five, at(40, 4, 5000))).toBe(true);
    expect(isOutlier(five, at(2, 4, 5000))).toBe(false);
  });
});

describe('isOnSpot', () => {
  const cluster = steady(10, 4, 9);

  it('is true back at the cluster, false 50 m away, false when the live fix is worse than 30 m', () => {
    expect(isOnSpot(cluster, at(1, 4, 20_000))).toBe(true);
    expect(isOnSpot(cluster, at(50, 4, 20_000))).toBe(false);
    expect(isOnSpot(cluster, at(0, 31, 20_000))).toBe(false);
  });

  it('is false with no samples', () => {
    expect(isOnSpot([], at(0, 4, 0))).toBe(false);
  });
});

describe('trimFrom', () => {
  it('drops samples at and after the cutoff', () => {
    const s = [at(0, 5, 100), at(0, 5, 200), at(0, 5, 300)];
    expect(trimFrom(s, 200).map((x) => x.at)).toEqual([100]);
  });
});
