import { column, Schema, Table } from '@powersync/common';

export const Tables = {
  missions: 'missions',
  mapItems: 'map_items',
  itemViewState: 'item_view_state',
  missionViewState: 'mission_view_state',
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
    updated_at: column.integer,
  },
  { localOnly: true, indexes: { mission: ['mission_id'] } },
);

export const appSchema = new Schema({
  [Tables.missions]: missions,
  [Tables.mapItems]: mapItems,
  [Tables.itemViewState]: itemViewState,
  [Tables.missionViewState]: missionViewState,
});
