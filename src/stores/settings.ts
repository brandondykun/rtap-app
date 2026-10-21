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
export type MissionSort = 'recent' | 'name' | 'most';
/** How dark the see-through panels over the map are (toolbar, readouts, map buttons, bars, toasts). */
export type PanelBackground = 'clear' | 'light' | 'heavy' | 'solid';
export const PANEL_BACKGROUNDS: readonly PanelBackground[] = ['clear', 'light', 'heavy', 'solid'];
export const MISSION_SORTS: readonly MissionSort[] = ['recent', 'name', 'most'];

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
  /** Tilted map with raised terrain and a sky (the 3D toolbar toggle). */
  terrain3d: boolean;
  /** Terrain height multiplier in 3D, 1–3. */
  terrainExaggeration: number;
  labelSize: LabelSize;
  missionSort: MissionSort;
  panelBackground: PanelBackground;
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
  toggleTerrain3d: () => void;
  /** Returns false (and changes nothing) unless finite and within 1–3. */
  setTerrainExaggeration: (x: number) => boolean;
  setLabelSize: (size: LabelSize) => void;
  setMissionSort: (sort: MissionSort) => void;
  setPanelBackground: (level: PanelBackground) => void;
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
  terrain3d: false,
  terrainExaggeration: 1.5,
  labelSize: 'medium',
  missionSort: 'recent',
  panelBackground: 'light',
};

const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => void Storage.removeItemSync(key),
};

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function validExaggeration(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= 1 && x <= 3;
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
    terrain3d: typeof p.terrain3d === 'boolean' ? p.terrain3d : current.terrain3d,
    terrainExaggeration: validExaggeration(p.terrainExaggeration) ? p.terrainExaggeration : current.terrainExaggeration,
    labelSize: pick(p.labelSize, ['small', 'medium', 'large'], current.labelSize),
    missionSort: pick(p.missionSort, MISSION_SORTS, current.missionSort),
    panelBackground: pick(p.panelBackground, PANEL_BACKGROUNDS, current.panelBackground),
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
      toggleTerrain3d: () => set({ terrain3d: !get().terrain3d }),
      setTerrainExaggeration: (x) => {
        if (!validExaggeration(x)) return false;
        set({ terrainExaggeration: x });
        return true;
      },
      setLabelSize: (labelSize) => set({ labelSize }),
      setMissionSort: (missionSort) => set({ missionSort }),
      setPanelBackground: (panelBackground) => set({ panelBackground }),
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
      partialize: ({ coordinateFormat, angleUnit, northRef, declinationOverrideDeg, basemap, altitudeUnit, showLineDistances, showZoomButtons, showCenterGrid, showToolbarText, showMapLabels, terrain3d, terrainExaggeration, labelSize, missionSort, panelBackground }) => ({
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
        terrain3d,
        terrainExaggeration,
        labelSize,
        missionSort,
        panelBackground,
      }),
    },
  ),
);
