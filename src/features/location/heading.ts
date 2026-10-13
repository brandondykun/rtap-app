import { toTrue } from '@/lib/geo/north/convert';
import type { LatLon } from '@/lib/geo/types';
import { normalizeDeg } from '@/lib/geo/units/angle';

export const HEADING_MIN_INTERVAL_MS = 100; // ≈10 Hz
export const HEADING_MIN_DELTA_DEG = 2;

export type HeadingSample = { heading: number; at: number };

/**
 * True heading from an expo-location heading event. Devices report −1 when a value is
 * unavailable; magnetic headings are converted with the declination model (or the override).
 */
export function trueHeadingFrom(
  event: { trueHeading: number; magHeading: number },
  position: LatLon | null,
  date: Date,
  declinationOverrideDeg: number | null,
): number | null {
  if (Number.isFinite(event.trueHeading) && event.trueHeading >= 0) return normalizeDeg(event.trueHeading);
  if (position === null || !Number.isFinite(event.magHeading) || event.magHeading < 0) return null;
  return toTrue(event.magHeading, 'magnetic', position, { date, declinationOverrideDeg });
}

/** Which way the screen is turned (expo-screen-orientation's Orientation values, by name). */
export type ScreenOrientation = 'portrait-up' | 'portrait-down' | 'landscape-left' | 'landscape-right' | 'unknown';

/**
 * Degrees to add to a compass heading so it points out of the top of the screen. The compass
 * reports where the phone's top edge points; turned sideways, the screen's up is 90° off that.
 * landscape-right: phone top points left, screen up is its right edge (+90°). landscape-left: −90°.
 */
export function screenHeadingOffset(orientation: ScreenOrientation): number {
  switch (orientation) {
    case 'landscape-right':
      return 90;
    case 'portrait-down':
      return 180;
    case 'landscape-left':
      return 270;
    default:
      return 0;
  }
}

/** Smallest angle between two headings, 0–180°. */
export function angularDistance(a: number, b: number): number {
  const d = normalizeDeg(a - b);
  return d > 180 ? 360 - d : d;
}

/** Throttles compass updates so the self layer re-renders at most ≈10 Hz and only on ≥2° change. */
export function shouldEmitHeading(prev: HeadingSample | null, next: number, now: number): boolean {
  if (prev === null) return true;
  if (now - prev.at < HEADING_MIN_INTERVAL_MS) return false;
  return angularDistance(prev.heading, next) >= HEADING_MIN_DELTA_DEG;
}
