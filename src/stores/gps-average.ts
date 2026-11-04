import { create } from 'zustand';

import {
  type AverageSample,
  clusterStats,
  type ClusterStats,
  isFarFromStats,
  isOnSpot,
  isOutlierFromStats,
  MOVED_FIXES,
  MOVED_SPEED_MPS,
  sampleFromFix,
  trimFrom,
} from '@/features/location/gps-average-math';
import type { SelfPosition } from '@/stores/presence';

/** Off: not averaging. Paused: moved off the spot, waiting. Away: back with a live fix that is not on the spot. */
export type AveragePhase = 'off' | 'averaging' | 'paused' | 'away';

/** When the move is only noticed by GPS, readings this far before it was noticed are dropped too. */
export const DROP_BACK_MS = 15000;
/** Each fix runs a few O(n) passes over the samples, so long averages are thinned to this many. */
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

function averaged(stats: ClusterStats | null, timestamp: number): SelfPosition | null {
  if (stats === null) return null;
  return {
    position: stats.center.position,
    altitudeM: stats.center.altitudeM,
    accuracyM: stats.accuracyM,
    timestamp,
    averaged: true,
  };
}

/**
 * Appends, thinning to every other sample past the cap while keeping the first and the newest. Thinning widens the gaps
 * between old samples, so after a long average some of its time may count short (MAX_SAMPLE_GAP_S): conservative.
 */
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
    // The samples' center, spread and accuracy, worked out once for all the checks below.
    const stats = clusterStats(samples);
    const sample = sampleFromFix(fix);
    // A fix too poor to average still shows a move when its speed says so or it lands far beyond its own noise.
    const judged = sample ?? sampleFromFix(fix, Infinity);
    // Without a valid time it cannot date the move, so it does not count.
    const far =
      Number.isFinite(fix.timestamp) &&
      ((stats !== null && judged !== null && isFarFromStats(stats, judged)) || (speedMps !== null && speedMps > MOVED_SPEED_MPS));
    if (far) {
      const count = farCount + 1;
      const since = farSince ?? fix.timestamp;
      if (count >= MOVED_FIXES) {
        get().pause(since);
        return null;
      }
      set({ farCount: count, farSince: since });
      return averaged(stats, fix.timestamp);
    }
    // A fix that cannot be used and shows no move neither counts as far nor resets the count: it is ignored.
    if (sample === null) return averaged(stats, fix.timestamp);
    if (stats !== null && isOutlierFromStats(stats, sample)) {
      set({ farCount: 0, farSince: null });
      return averaged(stats, fix.timestamp);
    }
    const next = append(samples, sample);
    set({ samples: next, farCount: 0, farSince: null });
    return averaged(clusterStats(next), fix.timestamp);
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
