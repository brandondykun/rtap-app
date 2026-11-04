import { estimateAccuracyM } from '@/features/location/gps-average-math';
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

  it('uses the last still moment from the motion sensor as the cutoff when known', () => {
    g().start();
    for (let i = 0; i < 10; i++) g().addFix(fix(i * 10_000), 0);
    g().markStill(52_000);
    for (let i = 0; i < 3; i++) g().addFix(fix(100_000 + i * 10_000, 5, FAR), 0);
    expect(g().phase).toBe('paused');
    expect(g().samples).toHaveLength(6);
  });

  it('resumes on the spot, and goes away when elsewhere or without a usable fix', () => {
    const paused = () => {
      useGpsAverage.setState({ ...INITIAL_GPS_AVERAGE, phase: 'averaging' });
      for (let i = 0; i < 5; i++) g().addFix(fix(i * 1000), 0);
      g().pause(100_000);
    };
    paused();
    expect(g().pausedAt).toBe(100_000);
    expect(g().resume(fix(120_000))).toBe('resumed');
    expect(g().phase).toBe('averaging');
    expect(g().pausedAt).toBeNull();
    paused();
    expect(g().resume(fix(120_000, 5, FAR))).toBe('away');
    expect(g().phase).toBe('away');
    paused();
    expect(g().resume(null)).toBe('away');
    paused();
    expect(g().resume(fix(120_000, 80))).toBe('away');
  });

  it('does not resume on a fix from before the pause, or on an averaged position', () => {
    const paused = () => {
      useGpsAverage.setState({ ...INITIAL_GPS_AVERAGE, phase: 'averaging' });
      for (let i = 0; i < 5; i++) g().addFix(fix(i * 1000), 0);
      g().pause(100_000);
    };
    paused();
    // The last fix before the phone was carried off: on the spot, but it says nothing about where the user is now.
    expect(g().resume(fix(90_000))).toBe('away');
    paused();
    expect(g().resume(fix(100_000))).toBe('away');
    paused();
    expect(g().resume({ ...fix(120_000), averaged: true })).toBe('away');
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

  it('ignores fixes while paused or away', () => {
    g().start();
    g().addFix(fix(0), 0);
    g().pause(100_000);
    expect(g().addFix(fix(20_000), 0)).toBeNull();
    expect(g().samples).toHaveLength(1);
    useGpsAverage.setState({ phase: 'away' });
    expect(g().addFix(fix(30_000), 0)).toBeNull();
    expect(g().samples).toHaveLength(1);
  });

  it('thins to at most 600 samples, keeping the first and the newest, and stays cheap per fix', () => {
    g().start();
    const last = MAX_SAMPLES + 2;
    const startedAt = performance.now();
    for (let i = 0; i <= last; i++) g().addFix(fix(i * 1000), 0);
    expect(performance.now() - startedAt).toBeLessThan(200);
    const next = g().samples;
    expect(next.length).toBeLessThanOrEqual(MAX_SAMPLES);
    expect(next[0].at).toBe(0);
    expect(next[next.length - 1].at).toBe(last * 1000);
  });
});
