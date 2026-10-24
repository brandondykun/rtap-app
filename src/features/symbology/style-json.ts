/**
 * An item's style JSON: `next`, plus whatever `existing` holds beyond the keys this app owns. A newer version of the
 * app may store more (say a dash pattern); an edit made here keeps it rather than wiping it.
 */
export function mergeStyle(existing: string | null | undefined, owned: readonly string[], next: Record<string, unknown>): string {
  let kept: Record<string, unknown> = {};
  try {
    const parsed: unknown = existing ? JSON.parse(existing) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) kept = parsed as Record<string, unknown>;
  } catch {
    // Unreadable style: nothing to keep.
  }
  const extra = Object.fromEntries(Object.entries(kept).filter(([k]) => !owned.includes(k)));
  return JSON.stringify({ ...next, ...extra });
}
