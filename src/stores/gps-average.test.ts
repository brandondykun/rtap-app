import { type AverageSample, clusterStats, estimateAccuracyM, fixCountOf, MOVED_FIXES_STILL, sampleFromFix, STILL_RECENT_MS } from '@/features/location/gps-average-math';
import type { SelfPosition } from '@/stores/presence';

import { DROP_BACK_MS, INITIAL_GPS_AVERAGE, MAX_SAMPLES, useGpsAverage } from './gps-average';

const HERE = { lat: 38.9, lon: -77 };
/** About 60 m north of HERE. */
const FAR = { lat: 38.9 + 60 / 111_320, lon: -77 };

const fix = (t: number, accuracyM: number | null = 5, position = HERE): SelfPosition => ({
  position,
  accuracyM,
  timestamp: t,
  altitudeM: 10,
});
const g = () => useGpsAverage.getState();

beforeEach(() => useGpsAverage.setState(INITIAL_GPS_AVERAGE));

describe('gps average store', () => {
  it('returns nothing to publish until a usable fix is averaged', () => {
    g().start();
    expect(g().addFix(fix(0, 40), 0)).toBeNull();
    expect(g().samples).toHaveLength(0);
    const out = g().addFix(fix(1000, 5), 0);
    expect(out).toMatchObject({ averaged: true, timestamp: 1000 });
    expect(out?.position.lat).toBeCloseTo(HERE.lat, 8);
    expect(out?.altitudeM).toBeCloseTo(10, 6);
  });

  it('averages fixes and reports the conservative accuracy', () => {
    g().start();
    let out: SelfPosition | null = null;
    for (let i = 0; i < 5; i++) out = g().addFix(fix(i * 10_000, 5), 0);
    expect(g().samples).toHaveLength(5);
    expect(out?.accuracyM).toBe(estimateAccuracyM(g().samples));
    expect(out?.accuracyM).toBeGreaterThanOrEqual(2);
  });

  it('pauses after three fixes far from the cluster, dropping the readings from before it was noticed', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 10_000), 0);
    expect(g().addFix(fix(100_000, 5, FAR), 0)).not.toBeNull();
    expect(g().farCount).toBe(1);
    expect(g().farSince).toBe(100_000);
    g().addFix(fix(110_000, 5, FAR), 0);
    expect(g().addFix(fix(120_000, 5, FAR), 0)).toBeNull();
    expect(g().phase).toBe('paused');
    expect(g().samples.every((s) => s.at < 100_000 - DROP_BACK_MS)).toBe(true);
    expect(g().samples).toHaveLength(9);
  });

  it('counts a fast fix as far, resets the count on a near one and ignores unusable fixes', () => {
    g().start();
    for (let i = 0; i < 3; i++) g().addFix(fix(i * 1000), 0);
    g().addFix(fix(4000), 2);
    g().addFix(fix(5000, 40), 0);
    expect(g().farCount).toBe(1);
    g().addFix(fix(6000), 0);
    expect(g().farCount).toBe(0);
    expect(g().farSince).toBeNull();
  });

  it('pauses on fixes too poor to average when they still clearly show movement', () => {
    /** About 500 m north of HERE. */
    const WAY_OFF = { lat: 38.9 + 500 / 111_320, lon: -77 };
    const settled = () => {
      useGpsAverage.setState({ ...INITIAL_GPS_AVERAGE, phase: 'averaging' });
      for (let i = 0; i < 10; i++) g().addFix(fix(i * 10_000), 0);
    };
    // Moving under cover: the accuracy drops past 30 m but the speed says moving.
    settled();
    for (let i = 0; i < 3; i++) g().addFix(fix(100_000 + i * 1000, 60), 1.4);
    expect(g().phase).toBe('paused');
    settled();
    for (let i = 0; i < 3; i++) g().addFix(fix(100_000 + i * 1000, null), 1.4);
    expect(g().phase).toBe('paused');
    // No speed, but far beyond even a ±60 m fix's noise.
    settled();
    for (let i = 0; i < 3; i++) g().addFix(fix(100_000 + i * 1000, 60, WAY_OFF), null);
    expect(g().phase).toBe('paused');
    // Without a valid time it cannot date the move: ignored, so nothing is trimmed by a NaN cutoff.
    settled();
    for (let i = 0; i < 3; i++) g().addFix(fix(NaN, 60), 1.4);
    expect(g().phase).toBe('averaging');
    expect(g().farCount).toBe(0);
    // Within its own noise: still ignored, never sampled.
    settled();
    for (let i = 0; i < 3; i++) g().addFix(fix(100_000 + i * 1000, 60, FAR), 0);
    expect(g().phase).toBe('averaging');
    expect(g().farCount).toBe(0);
    expect(g().samples).toHaveLength(10);
  });

  it('ignores the speed while the motion sensor says the phone lies still (Android reports some standing still)', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 1000), 0);
    g().markStill(Date.now());
    for (let i = 0; i < 5; i++) g().addFix(fix(10_000 + i * 1000), 1.4);
    expect(g().phase).toBe('averaging');
    expect(g().farCount).toBe(0);
    expect(g().samples).toHaveLength(15);
  });

  it('takes a long run of far fixes to pause while the phone lies still: a GPS wander is not a move', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 10_000), 0);
    g().markStill(Date.now());
    for (let i = 0; i < MOVED_FIXES_STILL - 1; i++) g().addFix(fix(100_000 + i * 1000, 5, FAR), 0);
    expect(g().phase).toBe('averaging');
    // Back near the cluster: the wander is over and its count starts again.
    g().addFix(fix(120_000), 0);
    expect(g().farCount).toBe(0);
    for (let i = 0; i < MOVED_FIXES_STILL; i++) g().addFix(fix(130_000 + i * 1000, 5, FAR), 0);
    expect(g().phase).toBe('paused');
  });

  it('counts the speed and a short run of far fixes again once the phone has not been still for a while', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    try {
      g().start();
      for (let i = 0; i < 10; i++) g().addFix(fix(i * 1000), 0);
      g().markStill(Date.now());
      jest.setSystemTime(1_000_000 + STILL_RECENT_MS + 1);
      for (let i = 0; i < 3; i++) g().addFix(fix(10_000 + i * 1000), 1.4);
      expect(g().phase).toBe('paused');
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses the last still moment from the motion sensor as the cutoff when known', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 10_000), 0);
    g().markStill(52_000);
    for (let i = 0; i < 3; i++) g().addFix(fix(100_000 + i * 10_000, 5, FAR), 0);
    expect(g().phase).toBe('paused');
    expect(g().samples).toHaveLength(6);
  });

  it('Resume always carries on, wherever the GPS puts the user, and does nothing unless paused', () => {
    g().start();
    for (let i = 0; i < 5; i++) g().addFix(fix(i * 1000), 0);
    g().noteLive(fix(120_000, 5, FAR));
    g().pause(100_000);
    expect(g().pausedAt).toBe(120_000);
    g().resume();
    expect(g()).toMatchObject({ phase: 'averaging', pausedAt: null, resumed: true, farCount: 0 });
    g().stop();
    g().resume();
    expect(g().phase).toBe('off');
  });

  it('after Resume, a GPS still off the spot does not pause by distance until a fix is back on it', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 10_000), 0);
    g().pause(100_000);
    const kept = g().samples.length;
    g().resume();
    // The GPS is still where it wandered: no pause, however many fixes, and none of them averaged.
    for (let i = 0; i < 20; i++) g().addFix(fix(110_000 + i * 1000, 5, FAR), 0);
    expect(g().phase).toBe('averaging');
    expect(g().samples).toHaveLength(kept);
    // Back on the spot: distance counts again.
    g().addFix(fix(140_000), 0);
    expect(g().resumed).toBe(false);
    for (let i = 0; i < 3; i++) g().addFix(fix(150_000 + i * 1000, 5, FAR), 0);
    expect(g().phase).toBe('paused');
  });

  it('after Resume, the speed still pauses when the phone is not lying still', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 1000), 0);
    g().pause(20_000);
    g().resume();
    for (let i = 0; i < 3; i++) g().addFix(fix(30_000 + i * 1000), 1.4);
    expect(g().phase).toBe('paused');
  });

  it('restartHere starts fresh; stop clears everything', () => {
    g().start();
    g().addFix(fix(0), 0);
    g().markStill(5);
    g().pause(10);
    expect(g().pausedAt).toBe(10);
    g().restartHere();
    expect(g()).toMatchObject({ phase: 'averaging', samples: [], farCount: 0, farSince: null, pausedAt: null });
    g().addFix(fix(0), 0);
    g().stop();
    expect(g()).toMatchObject(INITIAL_GPS_AVERAGE);
  });

  it('dates the pause by the newest fix, on the fix clock, so a fix from before it never counts as current (clock skew)', () => {
    // Android fixes carry satellite time: here two seconds ahead of the phone's clock.
    const SKEW = 2000;
    const paused = () => {
      useGpsAverage.setState(INITIAL_GPS_AVERAGE);
      g().start();
      for (let i = 0; i < 5; i++) {
        g().noteLive(fix(i * 10_000 + SKEW));
        g().addFix(fix(i * 10_000 + SKEW), 0);
      }
      // The motion sensor notices the move at phone time 41 s: before the last fix's own time (42 s).
      g().pause(41_000);
    };
    paused();
    expect(g().pausedAt).toBe(40_000 + SKEW);
  });

  it('counts the fixes averaged, through thinning, less the ones a pause drops', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 10_000), 0);
    // Unusable: not counted.
    g().addFix(fix(95_000, 80), 0);
    expect(g().fixCount).toBe(10);
    // Drops the fixes at 80 s and 90 s.
    g().pause(95_000);
    expect(g().samples).toHaveLength(8);
    expect(g().fixCount).toBe(8);

    useGpsAverage.setState(INITIAL_GPS_AVERAGE);
    g().start();
    for (let i = 0; i <= MAX_SAMPLES + 2; i++) g().addFix(fix(i * 1000), 0);
    expect(g().fixCount).toBe(MAX_SAMPLES + 3);
    expect(g().samples.length).toBeLessThanOrEqual(MAX_SAMPLES);
  });

  it('holds the average while paused, not while averaging or off', () => {
    g().start();
    for (let i = 0; i < 5; i++) g().addFix(fix(i * 10_000), 0);
    expect(g().held(1)).toBeNull();
    g().pause(100_000);
    expect(g().held(123)).toMatchObject({ averaged: true, timestamp: 123, accuracyM: estimateAccuracyM(g().samples) });
    expect(g().held(123)?.position.lat).toBeCloseTo(HERE.lat, 8);
    g().stop();
    expect(g().held(123)).toBeNull();
  });

  it('runs the stopwatch while averaging, stops it on pause, and restarts it on Resume, a new average or start', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    try {
      g().start();
      expect(g()).toMatchObject({ elapsedMs: 0, runningSince: 1_000_000 });
      for (let i = 0; i < 5; i++) g().addFix(fix(i * 1000), 0);
      jest.advanceTimersByTime(90_000);
      g().pause(100_000);
      expect(g()).toMatchObject({ elapsedMs: 90_000, runningSince: null });
      jest.advanceTimersByTime(5000);
      expect(g().runningSince).toBeNull();
      g().resume();
      expect(g()).toMatchObject({ elapsedMs: 90_000, runningSince: 1_095_000 });
      g().restartHere();
      expect(g()).toMatchObject({ elapsedMs: 0, runningSince: 1_095_000 });
      g().stop();
      expect(g()).toMatchObject({ elapsedMs: 0, runningSince: null });
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the newest live fix through start, restart and stop', () => {
    g().noteLive(fix(1000, 5, FAR));
    g().start();
    expect(g().live?.position).toEqual(FAR);
    g().restartHere();
    expect(g().live?.position).toEqual(FAR);
    g().stop();
    expect(g().live?.position).toEqual(FAR);
  });

  it('keeps every averaged fix for the map, trimmed with the samples on a pause', () => {
    g().start();
    for (let i = 0; i < 2000; i++) g().addFix(fix(i * 1000), 0);
    // Too poor to average: not drawn.
    g().addFix(fix(2_000_500, 80), 0);
    expect(g().fixes).toHaveLength(2000);
    expect(g().fixes[0]).toEqual({ lat: HERE.lat, lon: HERE.lon, accuracyM: 5, at: 0 });
    g().pause(1_990_000);
    expect(g().fixes).toHaveLength(g().fixCount);
    expect(g().fixes.every((f) => f.at < 1_975_000)).toBe(true);
  });

  it('switches the fixes on the map, keeping the choice for a new average but not past off', () => {
    g().start();
    g().toggleFixes();
    expect(g().showFixes).toBe(true);
    g().addFix(fix(0), 0);
    g().restartHere();
    expect(g()).toMatchObject({ showFixes: true, fixes: [] });
    g().stop();
    expect(g().showFixes).toBe(false);
    g().start();
    expect(g().showFixes).toBe(false);
  });

  it('ignores fixes while paused', () => {
    g().start();
    g().addFix(fix(0), 0);
    g().pause(100_000);
    expect(g().addFix(fix(20_000), 0)).toBeNull();
    expect(g().samples).toHaveLength(1);
  });

  it('thins to at most 600 samples, holding every fix from the first to the newest, and stays cheap per fix', () => {
    g().start();
    const last = MAX_SAMPLES + 2;
    const startedAt = performance.now();
    for (let i = 0; i <= last; i++) g().addFix(fix(i * 1000), 0);
    expect(performance.now() - startedAt).toBeLessThan(200);
    const next = g().samples;
    expect(next.length).toBeLessThanOrEqual(MAX_SAMPLES);
    expect(next[0].merged?.firstAt).toBe(0);
    expect(next[next.length - 1].at).toBe(last * 1000);
    expect(fixCountOf(next)).toBe(last + 1);
  });

  it('averages a long run exactly as if every fix were kept: same center, altitude, spread and ±', () => {
    // An hour at 1 fix/s, with scatter and accuracy that wander, and some fixes without altitude.
    const noisy = (i: number): SelfPosition => ({
      position: { lat: HERE.lat + (4 * Math.sin(i * 0.37) + 2 * Math.sin(i * 0.011)) / 111_320, lon: HERE.lon + (4 * Math.cos(i * 0.53)) / 86_600 },
      accuracyM: 4 + 3 * Math.abs(Math.sin(i * 0.07)),
      altitudeM: i % 7 === 0 ? null : 10 + Math.sin(i * 0.2),
      timestamp: i * 1000,
    });
    g().start();
    const raw: AverageSample[] = [];
    for (let i = 0; i < 3600; i++) {
      const before = g().fixCount;
      g().addFix(noisy(i), 0);
      // Only the fixes the store took (none is an outlier here, but stay honest).
      if (g().fixCount > before) raw.push(sampleFromFix(noisy(i))!);
    }
    expect(g().samples.length).toBeLessThanOrEqual(MAX_SAMPLES);
    expect(g().fixCount).toBe(raw.length);
    const thinned = clusterStats(g().samples)!;
    const all = clusterStats(raw)!;
    expect(thinned.count).toBe(all.count);
    expect(thinned.center.position.lat).toBeCloseTo(all.center.position.lat, 10);
    expect(thinned.center.position.lon).toBeCloseTo(all.center.position.lon, 10);
    expect(thinned.center.altitudeM).toBeCloseTo(all.center.altitudeM!, 8);
    expect(thinned.spreadM).toBeCloseTo(all.spreadM, 6);
    expect(thinned.accuracyM).toBeCloseTo(all.accuracyM, 6);
  });

  it('weighs the whole run evenly, not the last few minutes', () => {
    // Half an hour 2 m north of HERE, then half an hour 2 m south: the average sits on HERE.
    g().start();
    for (let i = 0; i < 3600; i++) g().addFix(fix(i * 1000, 5, { lat: HERE.lat + (i < 1800 ? 2 : -2) / 111_320, lon: HERE.lon }), 0);
    expect(clusterStats(g().samples)!.center.position.lat).toBeCloseTo(HERE.lat, 9);
  });

  it('trims a pause from thinned samples and counts exactly the fixes it keeps', () => {
    g().start();
    for (let i = 0; i < 2000; i++) g().addFix(fix(i * 1000), 0);
    g().pause(1_990_000);
    const kept = g().samples;
    expect(kept.every((s) => s.at < 1_975_000)).toBe(true);
    expect(g().fixCount).toBe(fixCountOf(kept));
    // At most a merged pair's worth more than the 15 s drop-back.
    expect(g().fixCount).toBeGreaterThanOrEqual(1975 - 4);
  });
});
