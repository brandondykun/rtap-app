import * as geomagnetism from 'geomagnetism';

import type { LatLon } from '../types';

type Model = ReturnType<typeof geomagnetism.model>;

// Building a model expands coefficients; readouts call this per frame, so cache by UTC day.
let cachedDay = '';
let cachedModel: Model | null = null;

function modelFor(date: Date): Model {
  const day = date.toISOString().slice(0, 10);
  if (cachedModel === null || day !== cachedDay) {
    // Fall back to the nearest model rather than throwing when the date is outside WMM2025.
    cachedModel = geomagnetism.model(date, { allowOutOfBoundsModel: true });
    cachedDay = day;
  }
  return cachedModel;
}

/**
 * Angle from true north to magnetic north, east positive (WMM).
 * magnetic azimuth = true azimuth − declination.
 */
export function declination(p: LatLon, date: Date, altitudeKm = 0): number {
  return modelFor(date).point([p.lat, p.lon, altitudeKm]).decl;
}
