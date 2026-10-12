import { isValidCamera, type MissionCamera } from '@/features/missions/repository';
import { normalizeDeg, wrapLon } from '@/lib/geo/units/angle';

/** Shown when a mission has no saved camera and there is no position fix yet. */
export const WORLD_CAMERA: MissionCamera = { center: { lat: 20, lon: 0 }, zoom: 1, bearing: 0 };
/** Zoom used when centering on the user (first fix, recenter). */
export const SELF_ZOOM = 15;
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

type MapStateLike = { properties: { center: number[]; zoom: number; heading: number } };

/** Map state → canonical camera (lon wrapped to [−180, 180], bearing in [0, 360)). Null if not finite. */
export function cameraFromMapState(state: MapStateLike): MissionCamera | null {
  const [lon, lat] = state.properties.center;
  const camera = {
    // wrapLon adds float noise (-77.2 -> -77.19999999999999), so only wrap when out of range.
    center: { lat, lon: lon >= -180 && lon <= 180 ? lon : wrapLon(lon) },
    zoom: state.properties.zoom,
    bearing: normalizeDeg(state.properties.heading),
  };
  return isValidCamera(camera) ? camera : null;
}

export function toCameraStop(camera: MissionCamera) {
  return {
    centerCoordinate: [camera.center.lon, camera.center.lat] as [number, number],
    zoomLevel: camera.zoom,
    heading: camera.bearing,
  };
}
