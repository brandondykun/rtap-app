import { migrations } from './migrations';
import type { Mission } from './models/Mission';
import { schema, Tables } from './schema';
import { LOCAL_ONLY_TABLES, SYNCED_TABLES } from './sync-config';
import { createTestDatabase } from './test-database';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('database', () => {
  it('creates records with UUIDv4 ids and decorated fields', async () => {
    const db = createTestDatabase();
    const mission = await db.write(() =>
      db.get<Mission>(Tables.missions).create((m) => {
        m.name = '  Alpha  ';
        m.createdBy = 'device-1';
      }),
    );
    expect(mission.id).toMatch(UUID_V4);
    expect(mission.name).toBe('Alpha'); // @text trims
    expect(mission.createdBy).toBe('device-1');
    expect(mission.createdAt).toBeInstanceOf(Date);
    expect(mission.updatedAt).toBeInstanceOf(Date);
  });

  it('classifies every table as synced or local-only', () => {
    const tables = Object.keys(schema.tables).sort();
    expect([...SYNCED_TABLES, ...LOCAL_ONLY_TABLES].sort()).toEqual(tables);
  });

  it('stores an optional ground elevation on map items, added by migration 3', () => {
    expect(schema.tables[Tables.mapItems].columns.elevation_m).toEqual({ name: 'elevation_m', type: 'number', isOptional: true });
    expect(migrations.sortedMigrations.find((m) => m.toVersion === 3)?.steps).toEqual([
      { type: 'add_columns', table: Tables.mapItems, columns: [{ name: 'elevation_m', type: 'number', isOptional: true }] },
    ]);
  });

  it('adds unit ranges to map items and show_ring to view state, in migration 4', () => {
    expect(schema.version).toBe(4);
    expect(migrations.maxVersion).toBe(4);
    const cols = schema.tables[Tables.mapItems].columns;
    for (const name of ['threat_range_m', 'horizontal_range_m', 'vertical_range_ft']) expect(cols[name]).toEqual({ name, type: 'number', isOptional: true });
    expect(schema.tables[Tables.itemViewState].columns.show_ring).toEqual({ name: 'show_ring', type: 'boolean', isOptional: true });
    expect(migrations.sortedMigrations.find((m) => m.toVersion === 4)?.steps).toEqual([
      { type: 'add_columns', table: Tables.mapItems, columns: [
        { name: 'threat_range_m', type: 'number', isOptional: true },
        { name: 'horizontal_range_m', type: 'number', isOptional: true },
        { name: 'vertical_range_ft', type: 'number', isOptional: true },
      ] },
      { type: 'add_columns', table: Tables.itemViewState, columns: [{ name: 'show_ring', type: 'boolean', isOptional: true }] },
    ]);
  });

  it('keeps view state local', () => {
    expect(LOCAL_ONLY_TABLES).toEqual(expect.arrayContaining([Tables.itemViewState, Tables.missionViewState]));
  });
});
