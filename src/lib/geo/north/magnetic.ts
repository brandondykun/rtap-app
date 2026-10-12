import * as geomagnetism from 'geomagnetism';

import type { LatLon } from '../types';

type Model = ReturnType<typeof geomagnetism.model>;

// Building a model expands coefficients; readouts call this per frame, so cache by UTC day.
let cachedDay = '';
let cachedModel: Model | null = null;

function modelFor(date: Date): Model {
  // An Invalid Date would throw in toISOString; fall back to now rather than failing a readout.
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = valid.toISOString().slice(0, 10);
  if (cachedModel === null || day !== cachedDay) {
    // Outside the WMM2025 window the library extrapolates the nearest model's secular variation
    // and logs a console error; the result is still finite.
    cachedModel = geomagnetism.model(valid, { allowOutOfBoundsModel: true });
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
