import type { Affiliation } from '@/features/symbology/presets';

export const NAME_PREFIX = { friend: 'FRD', hostile: 'HOS', neutral: 'NEU', unknown: 'UNK' } as const satisfies Record<
  Affiliation,
  string
>;

/** `<PREFIX>-<n>` where n is one more than the highest existing number for that prefix. */
export function nextNameForPrefix(prefix: string, existingNames: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  for (const name of existingNames) {
    const m = pattern.exec(name.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${max + 1}`;
}

export function nextAutoName(affiliation: Affiliation, existingNames: readonly string[]): string {
  return nextNameForPrefix(NAME_PREFIX[affiliation], existingNames);
}
