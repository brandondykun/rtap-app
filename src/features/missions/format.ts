const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "{verb} 5 min ago"; dates older than a week show as YYYY-MM-DD (UTC). */
function formatAgo(verb: string, ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return `${verb} just now`;
  if (diff < HOUR) return `${verb} ${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${verb} ${Math.floor(diff / HOUR)} h ago`;
  if (diff < 7 * DAY) return `${verb} ${Math.floor(diff / DAY)} d ago`;
  return `${verb} ${new Date(ts).toISOString().slice(0, 10)}`;
}

/** Mission row "last opened" text. */
export function formatLastOpened(ts: number | null, now: number): string {
  return ts === null ? 'Never opened' : formatAgo('Opened', ts, now);
}

/** When the mission last changed (every change is saved at once): "Saved 2 min ago". */
export function formatLastSaved(ts: number, now: number): string {
  return formatAgo('Saved', ts, now);
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "2 units · 1 point · 0 lines · 3 polygons" (row) or, with ' and ', "2 units, 1 point, 0 lines and 3 polygons" (sentence). */
export function formatCategoryCounts(c: { units: number; points: number; lines: number; polygons: number }, joiner = ' · '): string {
  const parts = [plural(c.units, 'unit'), plural(c.points, 'point'), plural(c.lines, 'line'), plural(c.polygons, 'polygon')];
  return joiner === ' and ' ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join(joiner);
}
