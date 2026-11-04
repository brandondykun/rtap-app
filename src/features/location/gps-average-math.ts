import type { LatLon } from '@/lib/geo/types';
import { toRad, wrapLon } from '@/lib/geo/units/angle';
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
/** A longer gap between samples (paused, or fixes rejected) counts only this long toward the time averaged. */
export const MAX_SAMPLE_GAP_S = 10;
/** Within this distance of the cluster a fix is always "on the spot", however good the accuracy. */
export const ON_SPOT_MIN_M = 10;

/** Needed before outlier rejection starts: with fewer, the center itself is too uncertain to judge by. */
const OUTLIER_MIN_SAMPLES = 5;
/** WGS84 semi-major axis (m) and eccentricity squared, for the local radii of curvature. */
const WGS84_A = 6_378_137;
const WGS84_E2 = 6.69437999014e-3;

export type AverageSample = { lat: number; lon: number; altitudeM: number | null; accuracyM: number; at: number };

type Center = { position: LatLon; altitudeM: number | null };

/**
 * A flat north/east metric frame around a point. With the ellipsoid's local radii it is within a millimeter of the
 * geodesic over the tens of meters averaging works at, and far cheaper per fix.
 */
type Frame = { lat: number; lon: number; mPerDegLat: number; mPerDegLon: number };

function frameAt(origin: LatLon): Frame {
  const sinLat = Math.sin(toRad(origin.lat));
  const w = 1 - WGS84_E2 * sinLat * sinLat;
  return {
    lat: origin.lat,
    lon: origin.lon,
    mPerDegLat: toRad((WGS84_A * (1 - WGS84_E2)) / (w * Math.sqrt(w))),
    mPerDegLon: toRad((WGS84_A / Math.sqrt(w)) * Math.cos(toRad(origin.lat))),
  };
}

function northM(f: Frame, lat: number): number {
  return (lat - f.lat) * f.mPerDegLat;
}

/** Wrapped, so fixes either side of the antimeridian stay meters apart. */
function eastM(f: Frame, lon: number): number {
  return wrapLon(lon - f.lon) * f.mPerDegLon;
}

/** Everything the per-fix checks need about the samples, worked out once per fix. */
export type ClusterStats = {
  count: number;
  center: Center;
  /** Weighted RMS distance of the samples from their center: how scattered the fixes really are. 0 for one sample. */
  spreadM: number;
  /** The honest ± of the averaged position (see estimateAccuracyM). */
  accuracyM: number;
  frame: Frame;
  centerNorthM: number;
  centerEastM: number;
};

/**
 * The fix as an averaging sample, or null when its accuracy is unknown, invalid (zero or negative, e.g. CoreLocation's
 * invalid-fix marker, which would also give an infinite weight) or worse than `maxAccuracyM` (by default too poor to
 * average), or when its position or time is not finite.
 */
export function sampleFromFix(fix: SelfPosition, maxAccuracyM = MAX_SAMPLE_ACCURACY_M): AverageSample | null {
  const { accuracyM } = fix;
  if (accuracyM === null || !Number.isFinite(accuracyM) || accuracyM <= 0 || accuracyM > maxAccuracyM) return null;
  const { lat, lon } = fix.position;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(fix.timestamp)) return null;
  const altitudeM = fix.altitudeM ?? null;
  return { lat, lon, altitudeM: altitudeM !== null && Number.isFinite(altitudeM) ? altitudeM : null, accuracyM, at: fix.timestamp };
}

/** Inverse-variance weight: a ±2 m fix counts sixteen times a ±8 m one. */
function weight(s: AverageSample): number {
  return 1 / (s.accuracyM * s.accuracyM);
}

/**
 * Center, spread and accuracy of the samples in two passes. The accuracy: the reported accuracies pooled, shrunk only
 * by how many independent correlation windows the averaging has covered (not by fix count, since consecutive fixes
 * share errors; and only time spent averaging, not paused), never below the floor or the observed spread.
 */
export function clusterStats(samples: readonly AverageSample[]): ClusterStats | null {
  if (samples.length === 0) return null;
  const frame = frameAt(samples[0]);
  let sumW = 0;
  let sumN = 0;
  let sumE = 0;
  let sumAltW = 0;
  let sumAlt = 0;
  let activeMs = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const w = weight(s);
    sumW += w;
    sumN += w * northM(frame, s.lat);
    sumE += w * eastM(frame, s.lon);
    if (s.altitudeM !== null) {
      sumAltW += w;
      sumAlt += w * s.altitudeM;
    }
    if (i > 0) activeMs += Math.min(s.at - samples[i - 1].at, MAX_SAMPLE_GAP_S * 1000);
  }
  const centerNorthM = sumN / sumW;
  const centerEastM = sumE / sumW;
  let sumSq = 0;
  if (samples.length > 1) {
    for (const s of samples) {
      const dn = northM(frame, s.lat) - centerNorthM;
      const de = eastM(frame, s.lon) - centerEastM;
      sumSq += weight(s) * (dn * dn + de * de);
    }
  }
  const spread = Math.sqrt(sumSq / sumW);
  const pooled = 1 / Math.sqrt(sumW / samples.length);
  const shrunk = pooled / Math.sqrt(Math.max(1, activeMs / 1000 / CORRELATION_S));
  return {
    count: samples.length,
    center: {
      position: { lat: frame.lat + centerNorthM / frame.mPerDegLat, lon: wrapLon(frame.lon + centerEastM / frame.mPerDegLon) },
      altitudeM: sumAltW > 0 ? sumAlt / sumAltW : null,
    },
    spreadM: spread,
    accuracyM: Math.max(ACCURACY_FLOOR_M, shrunk, spread),
    frame,
    centerNorthM,
    centerEastM,
  };
}

function distanceFromCenterM(stats: ClusterStats, s: AverageSample): number {
  return Math.hypot(northM(stats.frame, s.lat) - stats.centerNorthM, eastM(stats.frame, s.lon) - stats.centerEastM);
}

/** Accuracy-weighted mean position (in a local metric frame around the first sample) and altitude. Null for no samples. */
export function weightedCenter(samples: readonly AverageSample[]): Center | null {
  return clusterStats(samples)?.center ?? null;
}

/** Weighted RMS distance of the samples from their center: how scattered the fixes really are. 0 for one sample. */
export function spreadM(samples: readonly AverageSample[]): number {
  return clusterStats(samples)?.spreadM ?? 0;
}

/** Honest ± of the averaged position (see clusterStats). */
export function estimateAccuracyM(samples: readonly AverageSample[]): number {
  return clusterStats(samples)?.accuracyM ?? ACCURACY_FLOOR_M;
}

/** A fix far outside what the average and the fix itself allow. Needs enough samples for a trustworthy center. */
export function isOutlierFromStats(stats: ClusterStats, s: AverageSample): boolean {
  if (stats.count < OUTLIER_MIN_SAMPLES) return false;
  return distanceFromCenterM(stats, s) > OUTLIER_FACTOR * Math.max(s.accuracyM, stats.accuracyM);
}

export function isOutlier(samples: readonly AverageSample[], s: AverageSample): boolean {
  const stats = clusterStats(samples);
  return stats !== null && isOutlierFromStats(stats, s);
}

/**
 * The fix lies outside the cluster by more than the fix's noise and the cluster's own uncertainty (which covers its
 * scatter) allow together, so a settling receiver right after a poor first fix does not count as a move.
 */
export function isFarFromStats(stats: ClusterStats, s: AverageSample): boolean {
  return distanceFromCenterM(stats, s) > Math.max(ON_SPOT_MIN_M, 2 * Math.hypot(s.accuracyM, stats.accuracyM));
}

export function isFarFromCluster(samples: readonly AverageSample[], s: AverageSample): boolean {
  const stats = clusterStats(samples);
  return stats !== null && isFarFromStats(stats, s);
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
