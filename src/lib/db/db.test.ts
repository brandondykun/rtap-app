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

  it('keeps view state local', () => {
    expect(LOCAL_ONLY_TABLES).toEqual(expect.arrayContaining([Tables.itemViewState, Tables.missionViewState]));
  });
});
