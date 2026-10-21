import { useSettings } from '@/stores/settings';

/** Tilt the map eases to when 3D turns on (two fingers change it from there). */
export const THREE_D_PITCH = 60;
/** How long the tilt into and out of 3D takes. */
export const THREE_D_TILT_MS = 600;

/** Terrain height multiplier: the Settings value in 3D so hills read, true scale when flat. */
export function terrainExaggeration(threeD: boolean): number {
  return threeD ? useSettings.getState().terrainExaggeration : 1;
}
