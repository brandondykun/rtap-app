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
/** Far fixes in a row that count as having moved while the motion sensor says the phone lies still: GPS wander alone. */
export const MOVED_FIXES_STILL = 10;
/** The motion sensor said still this recently (ms, phone clock): the phone is lying where it was set. */
export const STILL_RECENT_MS = 3000;
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

/**
 * One fix, or several merged by thinning (`merged`). A merged sample sits at its fixes' weighted mean and keeps what the
 * stats need of them (weight, count, scatter, time), so thinning changes nothing about the average or its ±.
 */
export type AverageSample = {
  lat: number;
  lon: number;
  /** For a merged sample, the weighted mean of its fixes that had one. */
  altitudeM: number | null;
  /** For a merged sample, its fixes' pooled accuracy. */
  accuracyM: number;
  /** For a merged sample, its newest fix's time. */
  at: number;
  merged?: MergedFixes;
};

type MergedFixes = {
  count: number;
  firstAt: number;
  /** Total inverse-variance weight. */
  weight: number;
  /** Total weight of the fixes with an altitude. */
  altitudeWeight: number;
  /** Weighted sum of the fixes' squared distances (m²) from the sample's position. */
  scatterM2: number;
  /** Time averaged between its first and newest fix (gaps capped as in clusterStats). */
  activeMs: number;
};

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

/** Inverse-variance weight: a ±2 m fix counts sixteen times a ±8 m one. A merged sample weighs all its fixes. */
function weight(s: AverageSample): number {
  return s.merged?.weight ?? 1 / (s.accuracyM * s.accuracyM);
}

function altitudeWeight(s: AverageSample): number {
  return s.merged?.altitudeWeight ?? (s.altitudeM === null ? 0 : weight(s));
}

const fixesIn = (s: AverageSample) => s.merged?.count ?? 1;
const firstAt = (s: AverageSample) => s.merged?.firstAt ?? s.at;
/** Time averaged from one sample's newest fix to the next sample's first. */
const gapMs = (from: AverageSample, to: AverageSample) => Math.min(firstAt(to) - from.at, MAX_SAMPLE_GAP_S * 1000);

/** The fixes the samples hold (more than the samples once thinning has merged some). */
export function fixCountOf(samples: readonly AverageSample[]): number {
  let n = 0;
  for (const s of samples) n += fixesIn(s);
  return n;
}

/**
 * One sample standing for two consecutive ones: at their weighted mean, with their scatter carried over (parallel axis),
 * so the stats of a thinned list equal those of all its fixes.
 */
export function mergeSamples(a: AverageSample, b: AverageSample): AverageSample {
  const frame = frameAt(a);
  const wa = weight(a);
  const wb = weight(b);
  const w = wa + wb;
  const bn = northM(frame, b.lat);
  const be = eastM(frame, b.lon);
  const altA = altitudeWeight(a);
  const altB = altitudeWeight(b);
  const altW = altA + altB;
  const count = fixesIn(a) + fixesIn(b);
  return {
    lat: frame.lat + (wb * bn) / w / frame.mPerDegLat,
    lon: wrapLon(frame.lon + (wb * be) / w / frame.mPerDegLon),
    altitudeM: altW > 0 ? ((altA > 0 ? altA * a.altitudeM! : 0) + (altB > 0 ? altB * b.altitudeM! : 0)) / altW : null,
    accuracyM: Math.sqrt(count / w),
    at: b.at,
    merged: {
      count,
      firstAt: firstAt(a),
      weight: w,
      altitudeWeight: altW,
      scatterM2: (a.merged?.scatterM2 ?? 0) + (b.merged?.scatterM2 ?? 0) + ((wa * wb) / w) * (bn * bn + be * be),
      activeMs: (a.merged?.activeMs ?? 0) + (b.merged?.activeMs ?? 0) + gapMs(a, b),
    },
  };
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
    const altW = altitudeWeight(s);
    if (altW > 0) {
      sumAltW += altW;
      sumAlt += altW * s.altitudeM!;
    }
    activeMs += s.merged?.activeMs ?? 0;
    if (i > 0) activeMs += gapMs(samples[i - 1], s);
  }
  const centerNorthM = sumN / sumW;
  const centerEastM = sumE / sumW;
  let sumSq = 0;
  for (const s of samples) {
    const dn = northM(frame, s.lat) - centerNorthM;
    const de = eastM(frame, s.lon) - centerEastM;
    sumSq += (s.merged?.scatterM2 ?? 0) + weight(s) * (dn * dn + de * de);
  }
  const count = fixCountOf(samples);
  const spread = count > 1 ? Math.sqrt(sumSq / sumW) : 0;
  const pooled = 1 / Math.sqrt(sumW / count);
  const shrunk = pooled / Math.sqrt(Math.max(1, activeMs / 1000 / CORRELATION_S));
  return {
    count,
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

/** Samples recorded before the cutoff (a timestamp). A merged sample goes whole once any of its fixes is at or past it. */
export function trimFrom(samples: readonly AverageSample[], cutoffAt: number): AverageSample[] {
  return samples.filter((s) => s.at < cutoffAt);
}
