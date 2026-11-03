import { toTrue } from '@/lib/geo/north/convert';
import type { LatLon } from '@/lib/geo/types';
import { normalizeDeg } from '@/lib/geo/units/angle';

export const HEADING_MIN_INTERVAL_MS = 100; // ≈10 Hz
/** Smoothed headings are steady, so a small step is a real turn: the icon follows it rather than holding 2° off. */
export const HEADING_MIN_DELTA_DEG = 1;
/** How quickly the smoothed heading closes in on the compass: slowly for small wobbles, quickly for a real turn. */
export const HEADING_SMOOTH_MS = 300;
export const HEADING_FAST_MS = 60;
/** A compass change bigger than this is a turn, not sensor noise. */
export const HEADING_TURN_DEG = 15;

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

/**
 * The compass heading smoothed over time: Android compasses wobble a few degrees at rest, which ticked the location icon
 * back and forth. Each reading moves the heading part of the way to it (more the longer since the last), the short way
 * round north; a change of more than HEADING_TURN_DEG is followed almost at once, so turning still shows in real time.
 */
export function smoothHeading(prev: HeadingSample | null, next: number, now: number): HeadingSample {
  if (prev === null) return { heading: normalizeDeg(next), at: now };
  const dt = Math.max(0, now - prev.at);
  // Signed, the short way round: 350° → 10° is +20°, not −340°.
  const diff = ((((next - prev.heading) % 360) + 540) % 360) - 180;
  const tau = Math.abs(diff) > HEADING_TURN_DEG ? HEADING_FAST_MS : HEADING_SMOOTH_MS;
  const k = 1 - Math.exp(-dt / tau);
  return { heading: normalizeDeg(prev.heading + diff * k), at: now };
}

/** Smallest angle between two headings, 0–180°. */
export function angularDistance(a: number, b: number): number {
  const d = normalizeDeg(a - b);
  return d > 180 ? 360 - d : d;
}

/** Throttles compass updates so the self layer re-renders at most ≈10 Hz and only on a change of HEADING_MIN_DELTA_DEG or more. */
export function shouldEmitHeading(prev: HeadingSample | null, next: number, now: number): boolean {
  if (prev === null) return true;
  if (now - prev.at < HEADING_MIN_INTERVAL_MS) return false;
  return angularDistance(prev.heading, next) >= HEADING_MIN_DELTA_DEG;
}
