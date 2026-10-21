import type { LatLon } from '@/lib/geo/types';
import { useOp } from '@/stores/op';
import { useSettings } from '@/stores/settings';

/**
 * The OP while standing at one (null otherwise), with its true ground elevation: the drawn ground the camera sits on
 * includes the 3D terrain height, so it is divided back out. Null elevation until the ground is first read.
 */
export function useOpPosition(): { at: LatLon; elevationM: number | null } | null {
  const at = useOp((s) => (s.phase === 'on' ? s.at : null));
  const groundM = useOp((s) => s.groundM);
  // OP mode is always in 3D, so the drawn terrain uses this height.
  const exaggeration = useSettings((s) => s.terrainExaggeration);
  if (!at) return null;
  return { at, elevationM: groundM === null ? null : groundM / exaggeration };
}
