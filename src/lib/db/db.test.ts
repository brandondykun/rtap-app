import { newId } from './new-id';
import { appSchema, Tables } from './schema';
import { LOCAL_ONLY_TABLES, SYNCED_TABLES } from './sync-config';
import { createTestDatabase } from './test-database';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Every column of the WatermelonDB schema (v4) this replaced, with the SQLite type it now has:
// strings TEXT, timestamps and booleans (0/1) INTEGER, meters/feet REAL.
const OLD_COLUMNS: Record<string, Record<string, 'TEXT' | 'INTEGER' | 'REAL'>> = {
  [Tables.missions]: { name: 'TEXT', created_by: 'TEXT', created_at: 'INTEGER', updated_at: 'INTEGER' },
  [Tables.mapItems]: {
    mission_id: 'TEXT',
    kind: 'TEXT',
    geometry: 'TEXT',
    sidc: 'TEXT',
    name: 'TEXT',
    notes: 'TEXT',
    style: 'TEXT',
    elevation_m: 'REAL',
    threat_range_m: 'REAL',
    horizontal_range_m: 'REAL',
    vertical_range_ft: 'REAL',
    created_by: 'TEXT',
    updated_by: 'TEXT',
    created_at: 'INTEGER',
    updated_at: 'INTEGER',
  },
  [Tables.itemViewState]: { map_item_id: 'TEXT', hidden: 'INTEGER', show_ring: 'INTEGER', updated_at: 'INTEGER' },
  [Tables.missionViewState]: { mission_id: 'TEXT', last_opened_at: 'INTEGER', camera: 'TEXT', snapshot: 'TEXT', updated_at: 'INTEGER' },
};

describe('database', () => {
  it('stores records under UUIDv4 ids with ms timestamps', async () => {
    const db = createTestDatabase();
    const id = newId();
    expect(id).toMatch(UUID_V4);
    await db.execute('INSERT INTO missions (id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
      id,
      'Alpha',
      'device-1',
      1_700_000_000_000,
      1_700_000_000_000,
    ]);
    expect(await db.getOptional('SELECT * FROM missions WHERE id = ?', [id])).toEqual({
      id,
      name: 'Alpha',
      created_by: 'device-1',
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    });
  });

  it('classifies every table as synced or local-only', () => {
    const tables = appSchema.tables.map((t) => t.name).sort();
    expect([...SYNCED_TABLES, ...LOCAL_ONLY_TABLES].sort()).toEqual(tables);
  });

  it('keeps every column of the old schema, with its type', () => {
    // Every old table is still there (newer ones, like overlays, come after it).
    expect(appSchema.tables.map((t) => t.name)).toEqual(expect.arrayContaining(Object.keys(OLD_COLUMNS)));
    for (const table of appSchema.tables.filter((t) => t.name in OLD_COLUMNS)) {
      const types = Object.fromEntries(table.columns.map((c) => [c.name, c.type]));
      expect(types).toEqual(expect.objectContaining(OLD_COLUMNS[table.name]));
    }
  });

  it('keeps every table local-only on the device for now', () => {
    expect(appSchema.tables.length).toBeGreaterThan(0);
    expect(appSchema.tables.every((t) => t.localOnly)).toBe(true);
  });

  it('keeps view state local', () => {
    expect(LOCAL_ONLY_TABLES).toEqual(expect.arrayContaining([Tables.itemViewState, Tables.missionViewState]));
  });
});
