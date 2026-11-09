import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { LatLon } from '@/lib/geo/types';

/** Where "me" comes from. Only the user switches it; the app never does on its own. */
export type PositionSource = 'gps' | 'manual';

export type MyLocationValues = {
  source: PositionSource;
  /** The position set by hand; null when not set (always null on GPS). */
  manual: LatLon | null;
  /** The map's location-off notice was closed; it never shows again. */
  offNoticeClosed: boolean;
  /**
   * Development builds only (for store screenshots): the manual position shows as a GPS fix, with an accuracy, the
   * terrain altitude and the live compass. Ignored in other builds.
   */
  devFakeGps: boolean;
};

type MyLocationActions = {
  /** Saves the position and makes Manual the source. Returns false (and changes nothing) when invalid. */
  setManual: (at: LatLon) => boolean;
  /** Back to GPS; the manual position is cleared. */
  switchToGps: () => void;
  /** Manual without changing the position (unset after switchToGps). */
  switchToManual: () => void;
  closeOffNotice: () => void;
  setDevFakeGps: (on: boolean) => void;
};

export type MyLocationState = MyLocationValues & MyLocationActions;

export const DEFAULT_MY_LOCATION: MyLocationValues = { source: 'gps', manual: null, offNoticeClosed: false, devFakeGps: false };

const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => void Storage.removeItemSync(key),
};

function isValidPosition(p: unknown): p is LatLon {
  if (!p || typeof p !== 'object') return false;
  const { lat, lon } = p as Record<string, unknown>;
  return typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Validates persisted values field by field; anything invalid keeps the current value. */
function mergePersisted(persisted: unknown, current: MyLocationState): MyLocationState {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  return {
    ...current,
    source: p.source === 'gps' || p.source === 'manual' ? p.source : current.source,
    manual: p.manual === null || isValidPosition(p.manual) ? (p.manual as LatLon | null) : current.manual,
    offNoticeClosed: typeof p.offNoticeClosed === 'boolean' ? p.offNoticeClosed : current.offNoticeClosed,
    devFakeGps: typeof p.devFakeGps === 'boolean' ? p.devFakeGps : current.devFakeGps,
  };
}

/** The user's position source and manual position, kept on this phone. */
export const useMyLocation = create<MyLocationState>()(
  persist(
    (set) => ({
      ...DEFAULT_MY_LOCATION,
      setManual: (at) => {
        if (!isValidPosition(at)) return false;
        set({ source: 'manual', manual: { lat: at.lat, lon: at.lon } });
        return true;
      },
      switchToGps: () => set({ source: 'gps', manual: null }),
      switchToManual: () => set({ source: 'manual' }),
      closeOffNotice: () => set({ offNoticeClosed: true }),
      setDevFakeGps: (on) => set({ devFakeGps: on }),
    }),
    {
      name: 'my-location',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      merge: mergePersisted,
      partialize: ({ source, manual, offNoticeClosed, devFakeGps }) => ({ source, manual, offNoticeClosed, devFakeGps }),
    },
  ),
);
