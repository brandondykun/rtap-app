import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const Tables = {
  missions: 'missions',
  mapItems: 'map_items',
  itemViewState: 'item_view_state',
  missionViewState: 'mission_view_state',
} as const;

export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: Tables.missions,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_by', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: Tables.mapItems,
      columns: [
        { name: 'mission_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string', isIndexed: true },
        { name: 'geometry', type: 'string' },
        { name: 'sidc', type: 'string', isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'style', type: 'string', isOptional: true },
        { name: 'created_by', type: 'string' },
        { name: 'updated_by', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: Tables.itemViewState,
      columns: [
        { name: 'map_item_id', type: 'string', isIndexed: true },
        { name: 'hidden', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: Tables.missionViewState,
      columns: [
        { name: 'mission_id', type: 'string', isIndexed: true },
        { name: 'last_opened_at', type: 'number' },
        { name: 'camera', type: 'string', isOptional: true },
        { name: 'snapshot', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
