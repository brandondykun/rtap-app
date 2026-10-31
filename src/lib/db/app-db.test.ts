/**
 * @jest-environment node
 */
import type { Subscription } from 'rxjs';

import type { AppDb, AppDbTx } from './app-db';
import { newId } from './new-id';
import { closeSqlTestDbs, createSqlTestDb } from './sql-test-db';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Longer than PowerSync's 30 ms watch throttle, so a re-run that is coming has arrived.
const SETTLE_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil timed out');
    await sleep(5);
  }
}

function insertItem(db: AppDbTx, id: string, missionId: string, name = 'Item'): Promise<void> {
  return db.execute('INSERT INTO map_items (id, mission_id, kind, geometry, name, notes) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    missionId,
    'point',
    '{}',
    name,
    null,
  ]);
}

function insertViewState(db: AppDbTx, id: string, mapItemId: string): Promise<void> {
  return db.execute('INSERT INTO item_view_state (id, map_item_id, hidden, updated_at) VALUES (?, ?, ?, ?)', [
    id,
    mapItemId,
    1,
    1,
  ]);
}

describe('AppDb (PowerSync, SQLite in Node)', () => {
  let db: AppDb;
  let subs: Subscription[];

  beforeEach(() => {
    db = createSqlTestDb();
    subs = [];
  });

  afterEach(async () => {
    subs.forEach((s) => s.unsubscribe());
    await closeSqlTestDbs();
  });

  /** Subscribes and records every emission. */
  function record<T>(sql: string, params: (string | number | null)[], tables: string[]): T[][] {
    const seen: T[][] = [];
    subs.push(db.watch<T>(sql, params, tables).subscribe((rows) => seen.push(rows)));
    return seen;
  }

  it('round-trips a row with nulls and quotes', async () => {
    const name = 'O\'Brien "2"';
    await insertItem(db, 'i1', 'm1', name);
    const row = await db.getOptional<{ id: string; name: string; notes: string | null }>(
      'SELECT id, name, notes FROM map_items WHERE id = ?',
      ['i1'],
    );
    expect(row).toEqual({ id: 'i1', name, notes: null });
    expect(await db.getOptional('SELECT id FROM map_items WHERE id = ?', ['nope'])).toBeNull();
  });

  it('watch emits on subscribe and after a write to a watched table', async () => {
    const seen = record<{ id: string }>('SELECT id FROM map_items WHERE mission_id = ?', ['m1'], ['map_items']);
    await waitUntil(() => seen.length === 1);
    expect(seen[0]).toEqual([]);

    await insertItem(db, 'i1', 'm1');
    await waitUntil(() => seen.length === 2);
    expect(seen[1]).toEqual([{ id: 'i1' }]);
  });

  it('watch does not re-run for writes to tables it does not watch', async () => {
    const seen = record<{ id: string }>('SELECT id FROM map_items WHERE mission_id = ?', ['m1'], ['map_items']);
    await waitUntil(() => seen.length === 1);

    await insertViewState(db, 'v1', 'i1');
    await sleep(SETTLE_MS);
    expect(seen).toHaveLength(1);

    // Still live: a write to the watched table does re-run it.
    await insertItem(db, 'i1', 'm1');
    await waitUntil(() => seen.length === 2);
  });

  it('a throwing writeTransaction rolls back every write', async () => {
    await expect(
      db.writeTransaction(async (tx) => {
        await insertItem(tx, 'i1', 'm1');
        await insertItem(tx, 'i2', 'm1');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.getAll('SELECT id FROM map_items')).toEqual([]);
  });

  it('one transaction of 100 writes emits once', async () => {
    const seen = record<{ id: string }>('SELECT id FROM item_view_state', [], ['item_view_state']);
    await waitUntil(() => seen.length === 1);

    const result = await db.writeTransaction(async (tx) => {
      for (let i = 0; i < 100; i++) await insertViewState(tx, `v${i}`, `i${i}`);
      return 'done';
    });
    expect(result).toBe('done');
    await waitUntil(() => seen.length >= 2);
    await sleep(SETTLE_MS);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toHaveLength(100);
  });

  it('newId makes UUIDv4s', () => {
    expect(newId()).toMatch(UUID_V4);
    expect(newId()).not.toBe(newId());
  });
});
