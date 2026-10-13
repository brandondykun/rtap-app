import { isValidCamera, type MissionCamera } from '@/features/missions/repository';
import type { LatLon } from '@/lib/geo/types';
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

/** Mapbox GL world width in points at zoom 0. */
const WORLD_SIZE = 512;
const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latFromMercatorY = (y: number) => (Math.atan(Math.exp(y)) * 360) / Math.PI - 90;

/**
 * Center and zoom that fit `bounds` inside a visible area (points; the map minus any panel).
 * Used instead of Mapbox `bounds` stops, which rebuild the camera without our panel padding.
 */
export function fitBounds(bounds: { sw: LatLon; ne: LatLon }, visible: { width: number; height: number }): { center: LatLon; zoom: number } {
  const { sw, ne } = bounds;
  const y0 = mercatorY(sw.lat);
  const y1 = mercatorY(ne.lat);
  const dx = Math.max((ne.lon - sw.lon) / 360, 1e-9);
  const dy = Math.max(Math.abs(y1 - y0) / (2 * Math.PI), 1e-9);
  const zoom = Math.log2(Math.min(Math.max(visible.width, 1) / (WORLD_SIZE * dx), Math.max(visible.height, 1) / (WORLD_SIZE * dy)));
  return { center: { lat: latFromMercatorY((y0 + y1) / 2), lon: (sw.lon + ne.lon) / 2 }, zoom: clampZoom(zoom) };
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
