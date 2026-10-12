import { formatAngle, formatDistance, refLabel } from './format/measure';
import { inverse } from './measure/geodesic';
import { fromTrue, type NorthContext } from './north/convert';
import type { AngleUnit, LatLon, NorthRef } from './types';

export type VectorOptions = NorthContext & { unit: AngleUnit; ref: NorthRef };

export type Vector = {
  distanceM: number;
  /** Bearing in the requested north reference, degrees in [0, 360); null when too close. */
  bearingDeg: number | null;
  distanceLabel: string;
  bearingLabel: string;
  refLabel: string;
};

/**
 * Range and bearing from one position to another in the user's unit and north reference.
 * The only function UI should use for range/bearing so every readout agrees.
 */
export function describeVector(from: LatLon, to: LatLon, opts: VectorOptions): Vector {
  const { distanceM, azimuthTrue } = inverse(from, to);
  const bearingDeg = azimuthTrue === null ? null : fromTrue(azimuthTrue, opts.ref, from, opts);
  return {
    distanceM,
    bearingDeg,
    distanceLabel: formatDistance(distanceM),
    bearingLabel: formatAngle(bearingDeg, opts.unit),
    refLabel: refLabel(opts.ref),
  };
}
