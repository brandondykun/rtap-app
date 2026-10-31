import type { AbstractPowerSyncDatabase, LockContext } from '@powersync/common';
import { Observable } from 'rxjs';

export type SqlParams = readonly (string | number | null)[];

export type AppDbTx = {
  getAll<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getOptional<T>(sql: string, params?: SqlParams): Promise<T | null>;
  execute(sql: string, params?: SqlParams): Promise<void>;
};

/**
 * The app's database, as SQL. Features use this, never PowerSync directly, so tests can run the same code on
 * SQLite in Node.
 */
export type AppDb = AppDbTx & {
  /** All writes inside run atomically; a throw rolls them back. */
  writeTransaction<R>(fn: (tx: AppDbTx) => Promise<R>): Promise<R>;
  /** Re-runs the query whenever any of `tables` changes; emits its rows (first emission at subscribe). */
  watch<T>(sql: string, params: SqlParams, tables: readonly string[]): Observable<T[]>;
};

function wrapContext(ctx: LockContext): AppDbTx {
  return {
    getAll: (sql, params = []) => ctx.getAll(sql, [...params]),
    getOptional: (sql, params = []) => ctx.getOptional(sql, [...params]),
    execute: async (sql, params = []) => {
      await ctx.execute(sql, [...params]);
    },
  };
}

/** Adapts a PowerSync database (React Native in the app, Node in tests) to `AppDb`. */
export function fromPowerSync(db: AbstractPowerSyncDatabase): AppDb {
  return {
    ...wrapContext(db),
    writeTransaction: (fn) => db.writeTransaction((tx) => fn(wrapContext(tx))),
    watch: <T>(sql: string, params: SqlParams, tables: readonly string[]) =>
      new Observable<T[]>((subscriber) => {
        const abort = new AbortController();
        db.watch(
          sql,
          [...params],
          {
            onResult: (result) => subscriber.next((result.rows?._array ?? []) as T[]),
            onError: (error) => subscriber.error(error),
          },
          // Explicit tables: only writes to these re-run the query.
          { signal: abort.signal, tables: [...tables] },
        );
        return () => abort.abort();
      }),
  };
}
