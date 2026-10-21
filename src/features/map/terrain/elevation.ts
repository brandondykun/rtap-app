import type { MapView } from '@rnmapbox/maps';
import { useEffect, type RefObject } from 'react';

import type { LatLon } from '@/lib/geo/types';

/** How long a lookup may take before the elevation counts as unknown (a save never waits longer). */
export const ELEVATION_TIMEOUT_MS = 1000;

type ElevationSource = (at: LatLon) => Promise<number | null | undefined>;

let source: ElevationSource | null = null;

/** The map that answers elevation lookups; null when no map is mounted. */
export function setElevationSource(next: ElevationSource | null): void {
  source = next;
}

/**
 * Ground elevation in meters above sea level, from the terrain the map has loaded (MapCanvas).
 * Null when unknown: no map, no terrain loaded there yet, an error, or no answer in time.
 */
export async function elevationAt(at: LatLon): Promise<number | null> {
  const query = source;
  if (!query) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ELEVATION_TIMEOUT_MS);
  });
  try {
    const m = await Promise.race([query(at), timeout]);
    return typeof m === 'number' && Number.isFinite(m) ? m : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Answers elevation lookups from this map view while it is mounted. */
export function useElevationSource(mapRef: RefObject<Pick<MapView, 'queryTerrainElevation'> | null>): void {
  useEffect(() => {
    const query: ElevationSource = async (at) => mapRef.current?.queryTerrainElevation([at.lon, at.lat]);
    setElevationSource(query);
    return () => {
      // Only clear our own registration (a newer map may already have replaced it).
      if (source === query) setElevationSource(null);
    };
  }, [mapRef]);
}
