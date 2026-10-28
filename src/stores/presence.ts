import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

export type SelfPosition = {
  position: LatLon;
  accuracyM: number | null;
  timestamp: number;
  /** Altitude in meters (iOS: above sea level; Android: above the WGS84 ellipsoid), if known. */
  altitudeM?: number | null;
  /** Set by hand (Manual source), not a GPS fix. */
  manual?: boolean;
};
export type LocationStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

type PresenceValues = {
  selfPosition: SelfPosition | null;
  /** True heading in degrees, or null when the device has no usable compass reading. */
  selfHeading: number | null;
  locationStatus: LocationStatus;
};

type PresenceActions = {
  /** Ignores fixes with non-finite or out-of-range coordinates. */
  setSelfPosition: (fix: SelfPosition) => void;
  clearSelfPosition: () => void;
  setSelfHeading: (heading: number | null) => void;
  setLocationStatus: (status: LocationStatus) => void;
  reset: () => void;
};

export const INITIAL_PRESENCE: PresenceValues = { selfPosition: null, selfHeading: null, locationStatus: 'unknown' };

function isValidPosition(p: LatLon): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** Transient, in-memory presence (own position now, teammates later). Never stored in the DB. */
export const usePresence = create<PresenceValues & PresenceActions>()((set) => ({
  ...INITIAL_PRESENCE,
  setSelfPosition: (fix) => {
    if (isValidPosition(fix.position)) set({ selfPosition: fix });
  },
  clearSelfPosition: () => set({ selfPosition: null }),
  setSelfHeading: (selfHeading) => set({ selfHeading }),
  setLocationStatus: (locationStatus) => set({ locationStatus }),
  reset: () => set(INITIAL_PRESENCE),
}));
