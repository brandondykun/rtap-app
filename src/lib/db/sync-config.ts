import { Tables } from './schema';

/** Shared with other users once sync exists. */
export const SYNCED_TABLES = [Tables.missions, Tables.mapItems, Tables.overlays, Tables.mapItemOverlays] as const;

/** Per-device view state. Must be excluded from sync push and pull. */
export const LOCAL_ONLY_TABLES = [Tables.itemViewState, Tables.missionViewState, Tables.overlayViewState] as const;
