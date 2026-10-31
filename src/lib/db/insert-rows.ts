import type { AppDbTx } from './app-db';

export type SqlValue = string | number | null;

/** Rows per INSERT: 500 rows of map items' 16 columns stays well under SQLite's bound-variable limit. */
const CHUNK_ROWS = 500;

/**
 * Inserts rows (all with the same keys, which are column names written in code) as multi-row INSERTs of up to
 * 500 rows. Run it inside a transaction when the rows must land together.
 */
export async function insertRows(db: AppDbTx, table: string, rows: readonly Record<string, SqlValue>[]): Promise<void> {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const tuple = `(${columns.map(() => '?').join(', ')})`;
  for (let start = 0; start < rows.length; start += CHUNK_ROWS) {
    const chunk = rows.slice(start, start + CHUNK_ROWS);
    await db.execute(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => tuple).join(', ')}`,
      chunk.flatMap((row) => columns.map((c) => row[c])),
    );
  }
}

/** Sets columns (names written in code) on the row with this id. */
export function updateRow(db: AppDbTx, table: string, id: string, fields: Record<string, SqlValue>): Promise<void> {
  const columns = Object.keys(fields);
  return db.execute(`UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
    ...columns.map((c) => fields[c]),
    id,
  ]);
}
