import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { AngleUnit, NorthRef } from '@/lib/geo/types';

export type CoordinateFormat = 'mgrs' | 'latlon';
/** Mapbox basemap styles offered in Settings. */
export type Basemap = 'satellite' | 'hybrid' | 'topo' | 'dark';
export const BASEMAPS: readonly Basemap[] = ['satellite', 'hybrid', 'topo', 'dark'];
export type AltitudeUnit = 'm' | 'ft';
/** Text size of the name labels on map items. */
export type LabelSize = 'small' | 'medium' | 'large';

type SettingsValues = {
  coordinateFormat: CoordinateFormat;
  angleUnit: AngleUnit;
  northRef: NorthRef;
  /** Manual declination in degrees (east positive); null = use the WMM model. */
  declinationOverrideDeg: number | null;
  basemap: Basemap;
  altitudeUnit: AltitudeUnit;
  /** Distance chips between the points of the line being viewed or edited. */
  showLineDistances: boolean;
  /** The zoom in / zoom out buttons on the map (pinch still zooms). */
  showZoomButtons: boolean;
  /** The crosshair (map center) readout card. */
  showCenterGrid: boolean;
  /** Labels under the toolbar icons; off leaves icons only. */
  showToolbarText: boolean;
  /** Name labels on saved units, points, lines and polygons (the LABELS toolbar toggle). */
  showMapLabels: boolean;
  labelSize: LabelSize;
};

type SettingsActions = {
  setCoordinateFormat: (format: CoordinateFormat) => void;
  setAngleUnit: (unit: AngleUnit) => void;
  setNorthRef: (ref: NorthRef) => void;
  setBasemap: (basemap: Basemap) => void;
  setAltitudeUnit: (unit: AltitudeUnit) => void;
  setShowLineDistances: (show: boolean) => void;
  setShowZoomButtons: (show: boolean) => void;
  setShowCenterGrid: (show: boolean) => void;
  setShowToolbarText: (show: boolean) => void;
  toggleMapLabels: () => void;
  setLabelSize: (size: LabelSize) => void;
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
  altitudeUnit: 'm',
  showLineDistances: true,
  showZoomButtons: true,
  showCenterGrid: true,
  showToolbarText: true,
  showMapLabels: true,
  labelSize: 'medium',
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
    altitudeUnit: pick(p.altitudeUnit, ['m', 'ft'], current.altitudeUnit),
    showLineDistances: typeof p.showLineDistances === 'boolean' ? p.showLineDistances : current.showLineDistances,
    showZoomButtons: typeof p.showZoomButtons === 'boolean' ? p.showZoomButtons : current.showZoomButtons,
    showCenterGrid: typeof p.showCenterGrid === 'boolean' ? p.showCenterGrid : current.showCenterGrid,
    showToolbarText: typeof p.showToolbarText === 'boolean' ? p.showToolbarText : current.showToolbarText,
    showMapLabels: typeof p.showMapLabels === 'boolean' ? p.showMapLabels : current.showMapLabels,
    labelSize: pick(p.labelSize, ['small', 'medium', 'large'], current.labelSize),
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
      setAltitudeUnit: (altitudeUnit) => set({ altitudeUnit }),
      setShowLineDistances: (showLineDistances) => set({ showLineDistances }),
      setShowZoomButtons: (showZoomButtons) => set({ showZoomButtons }),
      setShowCenterGrid: (showCenterGrid) => set({ showCenterGrid }),
      setShowToolbarText: (showToolbarText) => set({ showToolbarText }),
      toggleMapLabels: () => set({ showMapLabels: !get().showMapLabels }),
      setLabelSize: (labelSize) => set({ labelSize }),
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
      partialize: ({ coordinateFormat, angleUnit, northRef, declinationOverrideDeg, basemap, altitudeUnit, showLineDistances, showZoomButtons, showCenterGrid, showToolbarText, showMapLabels, labelSize }) => ({
        coordinateFormat,
        angleUnit,
        northRef,
        declinationOverrideDeg,
        basemap,
        altitudeUnit,
        showLineDistances,
        showZoomButtons,
        showCenterGrid,
        showToolbarText,
        showMapLabels,
        labelSize,
      }),
    },
  ),
);
