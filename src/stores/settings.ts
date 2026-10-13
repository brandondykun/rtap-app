import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { AngleUnit, NorthRef } from '@/lib/geo/types';

export type CoordinateFormat = 'mgrs' | 'latlon';
/** Mapbox basemap styles offered in the Layers panel. */
export type Basemap = 'satellite' | 'hybrid' | 'topo' | 'dark';
export const BASEMAPS: readonly Basemap[] = ['satellite', 'hybrid', 'topo', 'dark'];
export type AltitudeUnit = 'm' | 'ft';

type SettingsValues = {
  coordinateFormat: CoordinateFormat;
  angleUnit: AngleUnit;
  northRef: NorthRef;
  /** Manual declination in degrees (east positive); null = use the WMM model. */
  declinationOverrideDeg: number | null;
  basemap: Basemap;
  /** The GPS toolbar toggle: show the user's position and altitude top-left. */
  showGps: boolean;
  altitudeUnit: AltitudeUnit;
  /** Distance chips between the points of the line being viewed or edited. */
  showLineDistances: boolean;
};

type SettingsActions = {
  setCoordinateFormat: (format: CoordinateFormat) => void;
  setAngleUnit: (unit: AngleUnit) => void;
  setNorthRef: (ref: NorthRef) => void;
  setBasemap: (basemap: Basemap) => void;
  toggleShowGps: () => void;
  setAltitudeUnit: (unit: AltitudeUnit) => void;
  setShowLineDistances: (show: boolean) => void;
  /** One-tap toggle used by the readout: grid ↔ magnetic (true north goes to grid). */
  toggleGridMagnetic: () => void;
  /** Returns false (and changes nothing) for non-finite values or |deg| > 180. */
  setDeclinationOverride: (deg: number | null) => boolean;
};

export type SettingsState = SettingsValues & SettingsActions;

export const DEFAULT_SETTINGS: SettingsValues = {
  coordinateFormat: 'mgrs',
  angleUnit: 'deg',
  northRef: 'grid',
  declinationOverrideDeg: null,
  basemap: 'satellite',
  showGps: false,
  altitudeUnit: 'm',
  showLineDistances: true,
};

const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => void Storage.removeItemSync(key),
};

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Validates persisted values field by field; anything invalid keeps the current value. */
function mergePersisted(persisted: unknown, current: SettingsState): SettingsState {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  const decl = p.declinationOverrideDeg;
  return {
    ...current,
    coordinateFormat: pick(p.coordinateFormat, ['mgrs', 'latlon'], current.coordinateFormat),
    angleUnit: pick(p.angleUnit, ['deg', 'mil'], current.angleUnit),
    northRef: pick(p.northRef, ['true', 'grid', 'magnetic'], current.northRef),
    declinationOverrideDeg:
      decl === null || (typeof decl === 'number' && Number.isFinite(decl) && Math.abs(decl) <= 180)
        ? decl
        : current.declinationOverrideDeg,
    basemap: pick(p.basemap, BASEMAPS, current.basemap),
    showGps: typeof p.showGps === 'boolean' ? p.showGps : current.showGps,
    altitudeUnit: pick(p.altitudeUnit, ['m', 'ft'], current.altitudeUnit),
    showLineDistances: typeof p.showLineDistances === 'boolean' ? p.showLineDistances : current.showLineDistances,
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      setCoordinateFormat: (coordinateFormat) => set({ coordinateFormat }),
      setAngleUnit: (angleUnit) => set({ angleUnit }),
      setNorthRef: (northRef) => set({ northRef }),
      setBasemap: (basemap) => set({ basemap }),
      toggleShowGps: () => set({ showGps: !get().showGps }),
      setAltitudeUnit: (altitudeUnit) => set({ altitudeUnit }),
      setShowLineDistances: (showLineDistances) => set({ showLineDistances }),
      toggleGridMagnetic: () => set({ northRef: get().northRef === 'grid' ? 'magnetic' : 'grid' }),
      setDeclinationOverride: (deg) => {
        if (deg !== null && (!Number.isFinite(deg) || Math.abs(deg) > 180)) return false;
        set({ declinationOverrideDeg: deg });
        return true;
      },
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      merge: mergePersisted,
      partialize: ({ coordinateFormat, angleUnit, northRef, declinationOverrideDeg, basemap, showGps, altitudeUnit, showLineDistances }) => ({
        coordinateFormat,
        angleUnit,
        northRef,
        declinationOverrideDeg,
        basemap,
        showGps,
        altitudeUnit,
        showLineDistances,
      }),
    },
  ),
);
