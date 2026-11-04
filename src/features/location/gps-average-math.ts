import { inverse } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';
import type { SelfPosition } from '@/stores/presence';

/** Fixes worse than this add more noise than signal, so they are never averaged. */
export const MAX_SAMPLE_ACCURACY_M = 30;
/** The averaged estimate never claims better than this: receiver bias doesn't average out. */
export const ACCURACY_FLOOR_M = 2;
/** Consecutive fixes share errors, so independent information accrues about once per this many seconds. */
export const CORRELATION_S = 60;
/** A fix this many accuracies (or estimates) from the center is rejected as an outlier. */
export const OUTLIER_FACTOR = 3;
/** Consecutive far-from-cluster fixes that count as having moved. */
export const MOVED_FIXES = 3;
/** Ground speed above this counts as moving. */
export const MOVED_SPEED_MPS = 0.5;
/** Within this distance of the cluster a fix is always "on the spot", however good the accuracy. */
export const ON_SPOT_MIN_M = 10;

/** Needed before outlier rejection starts: with fewer, the center itself is too uncertain to judge by. */
const OUTLIER_MIN_SAMPLES = 5;
/** Meters per degree of latitude; with the cosine of latitude for longitude, accurate to well under a meter at these distances. */
const M_PER_DEG_LAT = 111_320;

export type AverageSample = { lat: number; lon: number; altitudeM: number | null; accuracyM: number; at: number };

type Center = { position: LatLon; altitudeM: number | null };

/**
 * The fix as an averaging sample, or null when its accuracy is unknown, invalid (zero or negative, e.g. CoreLocation's
 * invalid-fix marker, which would also give an infinite weight) or too poor to use, or when its position or time is not finite.
 */
export function sampleFromFix(fix: SelfPosition): AverageSample | null {
  const { accuracyM } = fix;
  if (accuracyM === null || !Number.isFinite(accuracyM) || accuracyM <= 0 || accuracyM > MAX_SAMPLE_ACCURACY_M) return null;
  const { lat, lon } = fix.position;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(fix.timestamp)) return null;
  const altitudeM = fix.altitudeM ?? null;
  return { lat, lon, altitudeM: altitudeM !== null && Number.isFinite(altitudeM) ? altitudeM : null, accuracyM, at: fix.timestamp };
}

/** Inverse-variance weight: a ±2 m fix counts sixteen times a ±8 m one. */
function weight(s: AverageSample): number {
  return 1 / (s.accuracyM * s.accuracyM);
}

/** Accuracy-weighted mean position (in a local metric frame around the first sample) and altitude. Null for no samples. */
export function weightedCenter(samples: readonly AverageSample[]): Center | null {
  if (samples.length === 0) return null;
  const origin = samples[0];
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  let sumW = 0;
  let sumN = 0;
  let sumE = 0;
  let sumAltW = 0;
  let sumAlt = 0;
  for (const s of samples) {
    const w = weight(s);
    sumW += w;
    sumN += w * (s.lat - origin.lat) * M_PER_DEG_LAT;
    sumE += w * (s.lon - origin.lon) * mPerDegLon;
    if (s.altitudeM !== null) {
      sumAltW += w;
      sumAlt += w * s.altitudeM;
    }
  }
  return {
    position: { lat: origin.lat + sumN / sumW / M_PER_DEG_LAT, lon: origin.lon + sumE / sumW / mPerDegLon },
    altitudeM: sumAltW > 0 ? sumAlt / sumAltW : null,
  };
}

function distanceFromCenterM(center: Center, s: AverageSample): number {
  return inverse(center.position, { lat: s.lat, lon: s.lon }).distanceM;
}

/** Weighted RMS distance of the samples from their center: how scattered the fixes really are. 0 for one sample. */
export function spreadM(samples: readonly AverageSample[]): number {
  const center = weightedCenter(samples);
  if (center === null || samples.length < 2) return 0;
  let sumW = 0;
  let sumSq = 0;
  for (const s of samples) {
    const w = weight(s);
    const d = distanceFromCenterM(center, s);
    sumW += w;
    sumSq += w * d * d;
  }
  return Math.sqrt(sumSq / sumW);
}

/**
 * Honest ± of the averaged position. The reported accuracies pooled, shrunk only by how many independent
 * correlation windows the averaging has covered (not by fix count, since consecutive fixes share errors),
 * and never below the floor or the observed spread.
 */
export function estimateAccuracyM(samples: readonly AverageSample[]): number {
  if (samples.length === 0) return ACCURACY_FLOOR_M;
  const meanInverseVariance = samples.reduce((sum, s) => sum + weight(s), 0) / samples.length;
  const pooled = 1 / Math.sqrt(meanInverseVariance);
  const durationS = (samples[samples.length - 1].at - samples[0].at) / 1000;
  const shrunk = pooled / Math.sqrt(Math.max(1, durationS / CORRELATION_S));
  return Math.max(ACCURACY_FLOOR_M, shrunk, spreadM(samples));
}

/** A fix far outside what the average and the fix itself allow. Needs enough samples for a trustworthy center. */
export function isOutlier(samples: readonly AverageSample[], s: AverageSample): boolean {
  if (samples.length < OUTLIER_MIN_SAMPLES) return false;
  const center = weightedCenter(samples);
  if (center === null) return false;
  return distanceFromCenterM(center, s) > OUTLIER_FACTOR * Math.max(s.accuracyM, estimateAccuracyM(samples));
}

/** The fix lies outside the cluster by more than its own noise and the cluster's own scatter allow. */
export function isFarFromCluster(samples: readonly AverageSample[], s: AverageSample): boolean {
  const center = weightedCenter(samples);
  if (center === null) return false;
  return distanceFromCenterM(center, s) > Math.max(ON_SPOT_MIN_M, 2 * s.accuracyM, 2 * spreadM(samples));
}

/** The live fix is good enough to judge and still within the cluster. */
export function isOnSpot(samples: readonly AverageSample[], live: AverageSample): boolean {
  if (live.accuracyM > MAX_SAMPLE_ACCURACY_M || samples.length === 0) return false;
  return !isFarFromCluster(samples, live);
}

/** Samples recorded before the cutoff (a timestamp). */
export function trimFrom(samples: readonly AverageSample[], cutoffAt: number): AverageSample[] {
  return samples.filter((s) => s.at < cutoffAt);
}
