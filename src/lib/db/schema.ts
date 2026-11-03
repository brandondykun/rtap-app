import { column, Schema, Table } from '@powersync/common';

export const Tables = {
  missions: 'missions',
  mapItems: 'map_items',
  itemViewState: 'item_view_state',
  missionViewState: 'mission_view_state',
  overlays: 'overlays',
  mapItemOverlays: 'map_item_overlays',
  overlayViewState: 'overlay_view_state',
} as const;

// All local-only for now; the sync release switches missions and map_items to synced (see sync-config.ts).
// `id` is implicit: PowerSync adds it as the text primary key. Booleans are 0/1 integers, timestamps ms integers.
const missions = new Table(
  {
    name: column.text,
    created_by: column.text,
    created_at: column.integer,
    updated_at: column.integer,
  },
  { localOnly: true },
);

const mapItems = new Table(
  {
    mission_id: column.text,
    kind: column.text,
    geometry: column.text,
    sidc: column.text,
    name: column.text,
    notes: column.text,
    style: column.text,
    elevation_m: column.real,
    threat_range_m: column.real,
    horizontal_range_m: column.real,
    vertical_range_ft: column.real,
    created_by: column.text,
    updated_by: column.text,
    created_at: column.integer,
    updated_at: column.integer,
  },
  { localOnly: true, indexes: { mission: ['mission_id'], kind: ['kind'] } },
);

const itemViewState = new Table(
  {
    map_item_id: column.text,
    hidden: column.integer,
    show_ring: column.integer,
    updated_at: column.integer,
  },
  { localOnly: true, indexes: { map_item: ['map_item_id'] } },
);

const missionViewState = new Table(
  {
    mission_id: column.text,
    last_opened_at: column.integer,
    camera: column.text,
    snapshot: column.text,
    /** 1 while this device hides the mission's base (items in no overlay). */
    base_hidden: column.integer,
    updated_at: column.integer,
  },
  { localOnly: true, indexes: { mission: ['mission_id'] } },
);

/**
 * A mission's overlays: named, ordered sets of items ("Phase 1", "Fires") that can be shown or hidden together. Items in
 * no overlay are the base and always show. Shared with the mission once it syncs (with map_item_overlays).
 */
const overlays = new Table(
  {
    mission_id: column.text,
    name: column.text,
    sort_order: column.integer,
    created_by: column.text,
    created_at: column.integer,
    updated_at: column.integer,
  },
  { localOnly: true, indexes: { mission: ['mission_id'] } },
);

/** Which overlays an item is in (any number; none is the base). */
const mapItemOverlays = new Table(
  {
    mission_id: column.text,
    map_item_id: column.text,
    overlay_id: column.text,
    created_at: column.integer,
  },
  { localOnly: true, indexes: { item: ['map_item_id'], overlay: ['overlay_id'] } },
);

/** This device's view of an overlay: hidden or shown. Never synced, like item_view_state. */
const overlayViewState = new Table(
  {
    overlay_id: column.text,
    hidden: column.integer,
    updated_at: column.integer,
  },
  { localOnly: true, indexes: { overlay: ['overlay_id'] } },
);

export const appSchema = new Schema({
  [Tables.missions]: missions,
  [Tables.mapItems]: mapItems,
  [Tables.itemViewState]: itemViewState,
  [Tables.missionViewState]: missionViewState,
  [Tables.overlays]: overlays,
  [Tables.mapItemOverlays]: mapItemOverlays,
  [Tables.overlayViewState]: overlayViewState,
});
