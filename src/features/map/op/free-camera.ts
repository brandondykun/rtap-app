import type { MapView } from '@rnmapbox/maps';

import type { LatLon } from '@/lib/geo/types';

type NativeMap = { _runNative: (name: string, args: unknown[]) => Promise<unknown> };

/**
 * Places the camera at an exact spot and altitude (metres above sea level), looking along
 * pitch and bearing. Uses the patched native `setFreeCamera` through the map view's
 * undocumented `_runNative`; native failures are ignored.
 */
export function setFreeCamera(
  map: MapView | null,
  cam: { at: LatLon; altitudeM: number; pitch: number; bearing: number },
): void {
  if (!map) return;
  const values = [cam.at.lon, cam.at.lat, cam.altitudeM, cam.pitch, cam.bearing];
  (map as unknown as NativeMap)._runNative('setFreeCamera', [values]).catch(() => {});
}
