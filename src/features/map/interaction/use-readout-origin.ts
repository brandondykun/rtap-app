import type { LatLon } from '@/lib/geo/types';
import { useOp } from '@/stores/op';
import { usePresence } from '@/stores/presence';

/** Where the CTR readout measures from: the OP while standing at one, otherwise the user's position (maybe set by hand). */
export function useReadoutOrigin(): { from: LatLon | null; isOp: boolean; isManual: boolean } {
  const opAt = useOp((s) => (s.phase === 'on' ? s.at : null));
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const manual = usePresence((s) => s.selfPosition?.manual === true);
  return opAt ? { from: opAt, isOp: true, isManual: false } : { from: self, isOp: false, isManual: manual };
}
