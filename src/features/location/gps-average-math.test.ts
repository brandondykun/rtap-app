import { inverse } from '@/lib/geo/measure/geodesic';
import type { SelfPosition } from '@/stores/presence';

import {
  type AverageSample,
  clusterStats,
  estimateAccuracyM,
  isFarFromCluster,
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

  it('rejects zero and negative accuracy', () => {
    expect(sampleFromFix(fix(0))).toBeNull();
    expect(sampleFromFix(fix(-1))).toBeNull();
  });

  it('takes a looser accuracy limit when asked (for judging movement, not for averaging)', () => {
    expect(sampleFromFix(fix(80), Infinity)).toMatchObject({ accuracyM: 80 });
    expect(sampleFromFix(fix(null), Infinity)).toBeNull();
    expect(sampleFromFix(fix(0), Infinity)).toBeNull();
  });

  it('rejects non-finite coordinates or timestamp, and drops a non-finite altitude', () => {
    expect(sampleFromFix({ ...fix(5), position: { lat: NaN, lon: BASE.lon } })).toBeNull();
    expect(sampleFromFix({ ...fix(5), position: { lat: BASE.lat, lon: Infinity } })).toBeNull();
    expect(sampleFromFix({ ...fix(5), timestamp: NaN })).toBeNull();
    expect(sampleFromFix({ ...fix(5), altitudeM: NaN })?.altitudeM).toBeNull();
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

  it('counts only time spent averaging: a long pause does not shrink it', () => {
    const minute = steady(60, 6, 60);
    // Paused for 20 minutes, then resumed for two more fixes.
    const resumed = [...minute, at(0, 6, 60_000 + 20 * 60_000), at(0, 6, 61_000 + 20 * 60_000)];
    expect(estimateAccuracyM(resumed)).toBeGreaterThan(5.5);
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

describe('isFarFromCluster', () => {
  it('is false with no samples', () => {
    expect(isFarFromCluster([], at(100, 4, 0))).toBe(false);
  });

  it('judges a settled cluster by the fix accuracy, but never closer than 10 m', () => {
    const cluster = steady(60, 4, 300);
    expect(isFarFromCluster(cluster, at(8, 4, 301_000))).toBe(false);
    expect(isFarFromCluster(cluster, at(13, 4, 301_000))).toBe(true);
    expect(isFarFromCluster(cluster, at(13, 8, 301_000))).toBe(false);
  });

  it('allows for an uncertain cluster: good fixes right after a poor first one are not "far"', () => {
    // AVG pressed under canopy: one ±25 m fix, then the receiver settles to ±5 m some way off.
    const first = [at(0, 25, 0)];
    expect(isFarFromCluster(first, at(12, 5, 1000))).toBe(false);
    expect(isFarFromCluster(first, at(20, 5, 1000))).toBe(false);
    expect(isFarFromCluster([...first, at(15, 5, 1000)], at(20, 5, 2000))).toBe(false);
    // A real walk away is still far.
    expect(isFarFromCluster(first, at(80, 5, 1000))).toBe(true);
  });

  it('measures across the antimeridian', () => {
    const east = (m: number, t: number): AverageSample => ({ lat: 0, lon: 180 - m / M_PER_DEG_LAT, altitudeM: null, accuracyM: 4, at: t });
    const west = (m: number, t: number): AverageSample => ({ lat: 0, lon: -180 + m / M_PER_DEG_LAT, altitudeM: null, accuracyM: 4, at: t });
    const cluster = Array.from({ length: 10 }, (_, i) => (i % 2 ? east(1, i * 1000) : west(1, i * 1000)));
    expect(spreadM(cluster)).toBeLessThan(1.5);
    expect(Math.abs(weightedCenter(cluster)!.position.lon)).toBeGreaterThan(179.99);
    expect(isFarFromCluster(cluster, west(3, 20_000))).toBe(false);
    expect(isFarFromCluster(cluster, east(50, 20_000))).toBe(true);
  });
});

describe('clusterStats', () => {
  it('is null for no samples, and agrees with the single-purpose functions', () => {
    expect(clusterStats([])).toBeNull();
    const samples = [at(0, 4, 0, 100), at(6, 8, 1000, 104), at(-3, 3, 2000), at(2, 5, 3000, 101)];
    const stats = clusterStats(samples)!;
    expect(stats.count).toBe(4);
    expect(stats.center).toEqual(weightedCenter(samples));
    expect(stats.spreadM).toBeCloseTo(spreadM(samples), 9);
    expect(stats.accuracyM).toBe(estimateAccuracyM(samples));
  });

  it('measures distances to within a millimeter of the geodesic at averaging ranges', () => {
    const a = at(0, 5, 0);
    const b: AverageSample = { ...at(30, 5, 1000), lon: BASE.lon + 0.0005 };
    // Equal weights: the center is halfway, so the spread is half the distance between them.
    const geodesicM = inverse({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }).distanceM;
    expect(Math.abs(spreadM([a, b]) - geodesicM / 2)).toBeLessThan(0.001);
  });
});

describe('trimFrom', () => {
  it('drops samples at and after the cutoff', () => {
    const s = [at(0, 5, 100), at(0, 5, 200), at(0, 5, 300)];
    expect(trimFrom(s, 200).map((x) => x.at)).toEqual([100]);
  });
});
