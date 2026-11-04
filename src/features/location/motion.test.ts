import { createMotionDetector, loadAccelerometer } from '@/features/location/motion';

type Result = 'still' | 'moving' | null;

/** Feed `fn(t)` readings every 100 ms for `ms`, collecting each result with its time. */
function run(ms: number, fn: (t: number) => [number, number, number]) {
  const detector = createMotionDetector();
  const out: { t: number; r: Result }[] = [];
  for (let t = 0; t <= ms; t += 100) out.push({ t, r: detector.push(...fn(t), t) });
  return out;
}

describe('createMotionDetector', () => {
  it('stays quiet for a phone held still', () => {
    let seed = 1;
    const noise = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5) * 0.02;
    };
    const out = run(5000, () => [noise(), noise(), 1 + noise()]);
    expect(out.some((o) => o.r === 'moving')).toBe(false);
    expect(out.some((o) => o.r === 'still')).toBe(true);
  });

  it('reports moving once walking has lasted 1.5 s', () => {
    const out = run(5000, (t) => [0, 0, 1 + (Math.floor(t / 100) % 2 === 0 ? 0.2 : -0.2)]);
    const moving = out.filter((o) => o.r === 'moving');
    expect(moving).toHaveLength(1);
    expect(moving[0].t).toBeGreaterThanOrEqual(1500);
    expect(moving[0].t).toBeLessThanOrEqual(2500);
  });

  it('a single bump is not movement', () => {
    const out = run(5000, (t) => [0, 0, t === 2000 ? 1.5 : 1]);
    expect(out.some((o) => o.r === 'moving')).toBe(false);
  });
});

describe('loadAccelerometer', () => {
  it('returns the Accelerometer from expo-sensors', () => {
    expect(loadAccelerometer()).not.toBeNull();
  });

  it("returns null when expo-sensors can't load", () => {
    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock('expo-sensors', () => {
        throw new Error('no native module');
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadAccelerometer: load } = require('@/features/location/motion');
      expect(load()).toBeNull();
    });
    jest.dontMock('expo-sensors');
  });
});
