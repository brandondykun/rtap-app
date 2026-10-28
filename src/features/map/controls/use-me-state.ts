import { useMyLocation } from '@/stores/my-location';
import { usePresence, type SelfPosition } from '@/stores/presence';

/**
 * What the ME readout shows: a position (GPS, or set by hand when `fix.manual`), an offer to set one by hand (location
 * off, or Manual chosen without a position), or the wait for the first GPS fix.
 */
export type MeState = { kind: 'fix'; fix: SelfPosition } | { kind: 'set'; reason: 'off' | 'unset' } | { kind: 'waiting' };

export function useMeState(): MeState {
  const fix = usePresence((s) => s.selfPosition);
  const status = usePresence((s) => s.locationStatus);
  const source = useMyLocation((s) => s.source);
  const off = status === 'denied' || status === 'unavailable';
  // A position set by hand shows whatever the permission; a GPS fix only while location is on.
  if (fix && (fix.manual || !off)) return { kind: 'fix', fix };
  // On Manual without a position, that is what matters (location is usually off then anyway).
  if (source === 'manual') return { kind: 'set', reason: 'unset' };
  if (off) return { kind: 'set', reason: 'off' };
  return { kind: 'waiting' };
}

export const SET_LOCATION_MESSAGE = { off: 'Location is off', unset: 'Manual position not set' } as const;
