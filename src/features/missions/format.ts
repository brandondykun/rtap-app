const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Mission row "last opened" text. Dates older than a week show as YYYY-MM-DD (UTC). */
export function formatLastOpened(ts: number | null, now: number): string {
  if (ts === null) return 'Never opened';
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return 'Opened just now';
  if (diff < HOUR) return `Opened ${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `Opened ${Math.floor(diff / HOUR)} h ago`;
  if (diff < 7 * DAY) return `Opened ${Math.floor(diff / DAY)} d ago`;
  return `Opened ${new Date(ts).toISOString().slice(0, 10)}`;
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "2 units · 1 point" (row) or "2 units and 1 point" (sentence). */
export function formatCategoryCounts(c: { units: number; points: number }, joiner = ' · '): string {
  return `${plural(c.units, 'unit')}${joiner}${plural(c.points, 'point')}`;
}
