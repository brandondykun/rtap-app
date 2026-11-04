import { create } from 'zustand';

import {
  type AverageSample,
  estimateAccuracyM,
  isFarFromCluster,
  isOnSpot,
  isOutlier,
  MOVED_FIXES,
  MOVED_SPEED_MPS,
  sampleFromFix,
  trimFrom,
  weightedCenter,
} from '@/features/location/gps-average-math';
import type { SelfPosition } from '@/stores/presence';

/** Off: not averaging. Paused: moved off the spot, waiting. Away: back with a live fix that is not on the spot. */
export type AveragePhase = 'off' | 'averaging' | 'paused' | 'away';

/** When the move is only noticed by GPS, readings this far before it was noticed are dropped too. */
export const DROP_BACK_MS = 15000;
/** Each fix runs several O(n) geodesic passes, so long averages are thinned to this many samples. */
export const MAX_SAMPLES = 600;

type GpsAverageValues = {
  phase: AveragePhase;
  samples: AverageSample[];
  /** Last time the motion sensor reported standing still, if known. */
  lastStillAt: number | null;
  /** Timestamp of the first fix in the current run of far-from-cluster fixes. */
  farSince: number | null;
  farCount: number;
  /** When averaging paused: a fix from before then says nothing about where the user is now. */
  pausedAt: number | null;
};
type GpsAverageActions = {
  start: () => void;
  stop: () => void;
  /** The position to publish, or null while nothing is averaged yet (the caller then publishes the live fix). */
  addFix: (fix: SelfPosition, speedMps: number | null) => SelfPosition | null;
  markStill: (at: number) => void;
  pause: (detectedAt: number) => void;
  /** Resumes when the live fix (taken since the pause) is back on the spot; otherwise goes away. */
  resume: (live: SelfPosition | null) => 'resumed' | 'away';
  restartHere: () => void;
};

export const INITIAL_GPS_AVERAGE: GpsAverageValues = {
  phase: 'off',
  samples: [],
  lastStillAt: null,
  farSince: null,
  farCount: 0,
  pausedAt: null,
};

const FRESH: GpsAverageValues = { ...INITIAL_GPS_AVERAGE, phase: 'averaging' };

function averaged(samples: readonly AverageSample[], timestamp: number): SelfPosition | null {
  const center = weightedCenter(samples);
  if (center === null) return null;
  return {
    position: center.position,
    altitudeM: center.altitudeM,
    accuracyM: estimateAccuracyM(samples),
    timestamp,
    averaged: true,
  };
}

/** Appends, thinning to every other sample past the cap while keeping the first (the time span the accuracy depends on) and the newest. */
function append(samples: AverageSample[], s: AverageSample): AverageSample[] {
  if (samples.length < MAX_SAMPLES) return [...samples, s];
  return [...samples.filter((_, i) => i % 2 === 0), s];
}

/** Average mode: the fixes averaged so far and whether the device has moved off the spot. Lives only in memory. */
export const useGpsAverage = create<GpsAverageValues & GpsAverageActions>()((set, get) => ({
  ...INITIAL_GPS_AVERAGE,
  start: () => set(FRESH),
  stop: () => set(INITIAL_GPS_AVERAGE),
  addFix: (fix, speedMps) => {
    const { phase, samples, farCount, farSince } = get();
    if (phase !== 'averaging') return null;
    // A fix that cannot be used neither counts as far nor resets the count: it is ignored.
    const sample = sampleFromFix(fix);
    if (sample === null) return averaged(samples, fix.timestamp);
    const far =
      (samples.length > 0 && isFarFromCluster(samples, sample)) ||
      (speedMps !== null && speedMps > MOVED_SPEED_MPS);
    if (far) {
      const count = farCount + 1;
      const since = farSince ?? sample.at;
      if (count >= MOVED_FIXES) {
        get().pause(since);
        return null;
      }
      set({ farCount: count, farSince: since });
      return averaged(samples, fix.timestamp);
    }
    if (isOutlier(samples, sample)) {
      set({ farCount: 0, farSince: null });
      return averaged(samples, fix.timestamp);
    }
    const next = append(samples, sample);
    set({ samples: next, farCount: 0, farSince: null });
    return averaged(next, fix.timestamp);
  },
  markStill: (at) => set({ lastStillAt: at }),
  pause: (detectedAt) => {
    const { phase, samples, lastStillAt } = get();
    if (phase !== 'averaging') return;
    const cutoff = Math.min(detectedAt, lastStillAt ?? detectedAt - DROP_BACK_MS);
    set({ phase: 'paused', samples: trimFrom(samples, cutoff), farCount: 0, farSince: null, pausedAt: detectedAt });
  },
  resume: (live) => {
    const { phase, samples, pausedAt } = get();
    if (phase !== 'paused') return 'away';
    // Only a fix taken since the pause shows where the user is now; an older one (or the average itself) proves nothing.
    const fresh = live !== null && !live.averaged && (pausedAt === null || live.timestamp > pausedAt);
    const sample = fresh ? sampleFromFix(live) : null;
    const onSpot = sample !== null && isOnSpot(samples, sample);
    set({ phase: onSpot ? 'averaging' : 'away', farCount: 0, farSince: null, pausedAt: onSpot ? null : pausedAt });
    return onSpot ? 'resumed' : 'away';
  },
  restartHere: () => set(FRESH),
}));
