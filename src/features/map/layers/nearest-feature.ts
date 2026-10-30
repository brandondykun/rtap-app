import type { LatLon } from '@/lib/geo/types';

/** Taps count within this many pt of a symbol's edge (Mapbox's default is 22: a 44 pt box around the finger). */
export const SYMBOL_HITBOX = { width: 16, height: 16 };

type Feature = { geometry?: { type: string; coordinates?: unknown } | null };

/**
 * Of the features under a tap, the one whose point lies nearest it: with symbols close together the tap box can touch
 * several, and Mapbox lists them in no useful order. Features without a point geometry come last.
 */
export function nearestFeature<F extends Feature>(features: readonly F[], at: LatLon): F | undefined {
  // Squared distance on a local flat projection: plenty to order symbols a few pt apart.
  const k = Math.cos((at.lat * Math.PI) / 180);
  let best: F | undefined;
  let bestD = Infinity;
  for (const f of features) {
    const c = f.geometry?.type === 'Point' ? (f.geometry.coordinates as number[]) : null;
    const d = c ? ((c[0] - at.lon) * k) ** 2 + (c[1] - at.lat) ** 2 : Infinity;
    if (best === undefined || d < bestD) {
      best = f;
      bestD = d;
    }
  }
  return best;
}
