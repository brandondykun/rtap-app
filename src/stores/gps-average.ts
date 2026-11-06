import { create } from 'zustand';

import {
  type AverageSample,
  clusterStats,
  type ClusterStats,
  fixCountOf,
  isFarFromStats,
  isOnSpot,
  isOutlierFromStats,
  MOVED_FIXES,
  MOVED_FIXES_STILL,
  MOVED_SPEED_MPS,
  mergeSamples,
  sampleFromFix,
  STILL_RECENT_MS,
  trimFrom,
} from '@/features/location/gps-average-math';
import type { SelfPosition } from '@/stores/presence';

/**
 * Off: not averaging. Paused: moved off the spot, waiting. Away: back with a live fix that is not on the spot. Paused and
 * away hold the average as "me" until Resume, a new average, or off.
 */
export type AveragePhase = 'off' | 'averaging' | 'paused' | 'away';

/** When the move is only noticed by GPS, readings this far before it was noticed are dropped too. */
export const DROP_BACK_MS = 15000;
/** Each fix runs a few O(n) passes over the samples, so long averages are thinned to this many (merged, not dropped). */
export const MAX_SAMPLES = 600;

/** An averaged fix as drawn on the map. */
export type AverageFix = { lat: number; lon: number; accuracyM: number; at: number };

type GpsAverageValues = {
  phase: AveragePhase;
  samples: AverageSample[];
  /** Last time the motion sensor reported standing still, if known. */
  lastStillAt: number | null;
  /** Timestamp of the first fix in the current run of far-from-cluster fixes. */
  farSince: number | null;
  farCount: number;
  /**
   * The newest fix's time when averaging paused (the fix clock, which can differ from the phone's): only a later fix
   * says where the user is now.
   */
  pausedAt: number | null;
  /** The newest GPS fix as it came, kept through every phase: the user's real position while the average is held. */
  live: SelfPosition | null;
  /** Fixes averaged in this run (the samples hold them all, some merged by thinning). */
  fixCount: number;
  /** Every fix averaged in this run, one by one, for the map (the samples merge them on long runs). */
  fixes: AverageFix[];
  /** Draw the fixes on the map: switched from the fix count, kept through a new average, forgotten when turned off. */
  showFixes: boolean;
  /** The stopwatch, in phone time: what earlier stretches of averaging added up to, and when the current one began. */
  elapsedMs: number;
  runningSince: number | null;
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
  /** Records the newest GPS fix, before it is averaged. */
  noteLive: (fix: SelfPosition) => void;
  /** The average to hold as "me" while paused or away (null when off, averaging, or nothing was averaged). */
  held: (timestamp: number) => SelfPosition | null;
  toggleFixes: () => void;
};

export const INITIAL_GPS_AVERAGE: GpsAverageValues = {
  phase: 'off',
  samples: [],
  lastStillAt: null,
  farSince: null,
  farCount: 0,
  pausedAt: null,
  live: null,
  fixCount: 0,
  fixes: [],
  showFixes: false,
  elapsedMs: 0,
  runningSince: null,
};

/** A new run, keeping the newest fix (it dates a pause that comes before the run's first fix). */
const newRun = (live: SelfPosition | null): GpsAverageValues => ({ ...INITIAL_GPS_AVERAGE, phase: 'averaging', live, runningSince: Date.now() });

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
 * Appends, past the cap merging consecutive pairs into one sample each. Every fix keeps its full weight however long
 * the average runs: older stretches are only held more coarsely, which matters just for how much a pause trims.
 */
function append(samples: AverageSample[], s: AverageSample): AverageSample[] {
  if (samples.length < MAX_SAMPLES) return [...samples, s];
  const thinned: AverageSample[] = [];
  for (let i = 0; i < samples.length; i += 2) thinned.push(i + 1 < samples.length ? mergeSamples(samples[i], samples[i + 1]) : samples[i]);
  return [...thinned, s];
}

/** Average mode: the fixes averaged so far and whether the device has moved off the spot. Lives only in memory. */
export const useGpsAverage = create<GpsAverageValues & GpsAverageActions>()((set, get) => ({
  ...INITIAL_GPS_AVERAGE,
  start: () => set(newRun(get().live)),
  stop: () => set({ ...INITIAL_GPS_AVERAGE, live: get().live }),
  addFix: (fix, speedMps) => {
    const { phase, samples, farCount, farSince, lastStillAt } = get();
    if (phase !== 'averaging') return null;
    // The motion sensor says the phone lies still: its speed is noise then (Android reports some standing still), and
    // only a long run of far fixes counts as a move, not the GPS wandering while it sits.
    const still = lastStillAt !== null && Date.now() - lastStillAt <= STILL_RECENT_MS;
    // The samples' center, spread and accuracy, worked out once for all the checks below.
    const stats = clusterStats(samples);
    const sample = sampleFromFix(fix);
    // A fix too poor to average still shows a move when its speed says so or it lands far beyond its own noise.
    const judged = sample ?? sampleFromFix(fix, Infinity);
    // Without a valid time it cannot date the move, so it does not count.
    const far =
      Number.isFinite(fix.timestamp) &&
      ((stats !== null && judged !== null && isFarFromStats(stats, judged)) || (!still && speedMps !== null && speedMps > MOVED_SPEED_MPS));
    if (far) {
      const count = farCount + 1;
      const since = farSince ?? fix.timestamp;
      if (count >= (still ? MOVED_FIXES_STILL : MOVED_FIXES)) {
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
    const drawn: AverageFix = { lat: sample.lat, lon: sample.lon, accuracyM: sample.accuracyM, at: sample.at };
    set({ samples: next, fixCount: get().fixCount + 1, fixes: [...get().fixes, drawn], farCount: 0, farSince: null });
    return averaged(clusterStats(next), fix.timestamp);
  },
  markStill: (at) => set({ lastStillAt: at }),
  pause: (detectedAt) => {
    const { phase, samples, fixes, lastStillAt, live, elapsedMs, runningSince } = get();
    if (phase !== 'averaging') return;
    const cutoff = Math.min(detectedAt, lastStillAt ?? detectedAt - DROP_BACK_MS);
    const kept = trimFrom(samples, cutoff);
    // The samples run in time order, so the kept fixes are those up to the last kept sample's newest.
    const keptUntil = kept.length === 0 ? -Infinity : kept[kept.length - 1].at;
    set({
      phase: 'paused',
      samples: kept,
      fixCount: fixCountOf(kept),
      fixes: fixes.filter((f) => f.at <= keptUntil),
      farCount: 0,
      farSince: null,
      // On the fix clock when there is a fix: Android fixes carry satellite time, which can run ahead of the phone's.
      pausedAt: live?.timestamp ?? detectedAt,
      // The stopwatch stops when the pause is noticed.
      elapsedMs: elapsedMs + (runningSince === null ? 0 : Math.max(0, Date.now() - runningSince)),
      runningSince: null,
    });
  },
  resume: (live) => {
    const { phase, samples, pausedAt } = get();
    if (phase !== 'paused') return 'away';
    // Only a fix taken since the pause shows where the user is now; an older one (or the average itself) proves nothing.
    const fresh = live !== null && !live.averaged && (pausedAt === null || live.timestamp > pausedAt);
    const sample = fresh ? sampleFromFix(live) : null;
    const onSpot = sample !== null && isOnSpot(samples, sample);
    set({ phase: onSpot ? 'averaging' : 'away', farCount: 0, farSince: null, pausedAt: onSpot ? null : pausedAt, runningSince: onSpot ? Date.now() : null });
    return onSpot ? 'resumed' : 'away';
  },
  restartHere: () => set({ ...newRun(get().live), showFixes: get().showFixes }),
  noteLive: (fix) => set({ live: fix }),
  held: (timestamp) => {
    const { phase, samples } = get();
    if (phase !== 'paused' && phase !== 'away') return null;
    return averaged(clusterStats(samples), timestamp);
  },
  toggleFixes: () => set({ showFixes: !get().showFixes }),
}));
