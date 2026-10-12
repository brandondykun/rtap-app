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

export function formatItemCount(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}
