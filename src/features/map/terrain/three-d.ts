import { useSettings } from '@/stores/settings';

/** Tilt the map eases to when 3D turns on (two fingers change it from there). */
export const THREE_D_PITCH = 60;
/** How long the tilt into and out of 3D takes. */
export const THREE_D_TILT_MS = 600;

/**
 * Terrain height in 2D with the Terrain in 2D setting off: flat to the eye (a 3,000 m peak rises 3 m), but not 0, so
 * elevation lookups still read the ground and can divide this back out.
 */
export const FLAT_2D_EXAGGERATION = 0.001;

/**
 * Terrain height multiplier: the Settings value (`height`) in 3D so hills read; in 2D true scale, or near flat with
 * Terrain in 2D (`in2d`) off. Both default to the current settings.
 */
export function terrainExaggeration(threeD: boolean, height = useSettings.getState().terrainExaggeration, in2d = useSettings.getState().terrainIn2d): number {
  if (threeD) return height;
  return in2d ? 1 : FLAT_2D_EXAGGERATION;
}
