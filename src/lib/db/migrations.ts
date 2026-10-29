import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

import { Tables } from './schema';

// Append-only. Never edit a migration that has shipped; add a new one and bump schema.version.
export const migrations = schemaMigrations({
  migrations: [
    {
      // Map pictures for the missions list (local to the device, like the camera).
      toVersion: 2,
      steps: [addColumns({ table: Tables.missionViewState, columns: [{ name: 'snapshot', type: 'string', isOptional: true }] })],
    },
    {
      // Ground elevation (meters above sea level) of units, looked up from map terrain when placed.
      toVersion: 3,
      steps: [addColumns({ table: Tables.mapItems, columns: [{ name: 'elevation_m', type: 'number', isOptional: true }] })],
    },
    {
      // Artillery / air defense ranges (shared) and per-device range-ring visibility.
      toVersion: 4,
      steps: [
        addColumns({
          table: Tables.mapItems,
          columns: [
            { name: 'threat_range_m', type: 'number', isOptional: true },
            { name: 'horizontal_range_m', type: 'number', isOptional: true },
            { name: 'vertical_range_ft', type: 'number', isOptional: true },
          ],
        }),
        addColumns({ table: Tables.itemViewState, columns: [{ name: 'show_ring', type: 'boolean', isOptional: true }] }),
      ],
    },
  ],
});
