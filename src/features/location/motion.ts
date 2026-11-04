/** Window the acceleration spread is measured over. */
export const MOTION_WINDOW_MS = 1000;
/** Spread (std dev of magnitude, in g) above which the phone counts as being carried. Tuned on device. */
export const MOVING_STD_G = 0.06;
/** Spread below which the phone counts as set down again. Lower than MOVING_STD_G so it doesn't flap. */
export const STILL_STD_G = 0.03;
/** How long the spread must stay high before we call it movement, so one bump doesn't pause averaging. */
export const MOVING_FOR_MS = 1500;
export const ACCEL_INTERVAL_MS = 100;

/** Fewest readings in the window before the spread means anything. */
const MIN_SAMPLES = 3;

/**
 * Watches accelerometer readings and reports when the phone starts being carried or is set down. Gravity is
 * constant, so the spread of the total magnitude is a cheap orientation-free movement signal.
 */
export function createMotionDetector() {
  let samples: { at: number; mag: number }[] = [];
  let highSince: number | null = null;
  let reported = false;

  return {
    push(x: number, y: number, z: number, at: number): 'still' | 'moving' | null {
      samples.push({ at, mag: Math.sqrt(x * x + y * y + z * z) });
      samples = samples.filter((s) => s.at > at - MOTION_WINDOW_MS);
      if (samples.length < MIN_SAMPLES) return null;

      const mean = samples.reduce((sum, s) => sum + s.mag, 0) / samples.length;
      const std = Math.sqrt(samples.reduce((sum, s) => sum + (s.mag - mean) ** 2, 0) / samples.length);

      if (std > MOVING_STD_G) {
        highSince ??= at;
        if (!reported && at - highSince >= MOVING_FOR_MS) {
          reported = true;
          return 'moving';
        }
        return null;
      }
      highSince = null;
      if (std < STILL_STD_G) {
        reported = false;
        return 'still';
      }
      return null;
    },
  };
}

export type AccelerometerLike = {
  addListener(cb: (m: { x: number; y: number; z: number }) => void): { remove(): void };
  setUpdateInterval(ms: number): void;
  isAvailableAsync(): Promise<boolean>;
};

/** Builds made before expo-sensors was added lack its native module, and loading it then throws. */
export function loadAccelerometer(): AccelerometerLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sensors').Accelerometer as AccelerometerLike;
  } catch {
    return null;
  }
}
