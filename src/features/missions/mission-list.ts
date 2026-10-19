import { splitMgrs, toMgrs } from '@/lib/geo/coords/mgrs';
import type { LatLon } from '@/lib/geo/types';
import type { MissionSort } from '@/stores/settings';

import type { CategoryCounts, MissionSummary } from './repository';

export const NO_COUNTS: CategoryCounts = { units: 0, points: 0, lines: 0, polygons: 0 };

export function totalItems(c: CategoryCounts): number {
  return c.units + c.points + c.lines + c.polygons;
}

const byName = (a: MissionSummary, b: MissionSummary) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Last opened first; never-opened missions last, by name. */
function byRecent(a: MissionSummary, b: MissionSummary): number {
  if (a.lastOpenedAt !== b.lastOpenedAt) {
    if (a.lastOpenedAt === null) return 1;
    if (b.lastOpenedAt === null) return -1;
    return b.lastOpenedAt - a.lastOpenedAt;
  }
  return byName(a, b);
}

export function sortMissions(list: readonly MissionSummary[], sort: MissionSort, counts: ReadonlyMap<string, CategoryCounts>): MissionSummary[] {
  const total = (m: MissionSummary) => totalItems(counts.get(m.id) ?? NO_COUNTS);
  const compare =
    sort === 'name' ? (a: MissionSummary, b: MissionSummary) => byName(a, b) || byRecent(a, b)
    : sort === 'most' ? (a: MissionSummary, b: MissionSummary) => total(b) - total(a) || byRecent(a, b)
    : byRecent;
  return [...list].sort(compare);
}

/** Missions whose name contains the query, ignoring case; a blank query keeps every mission. */
export function filterMissions(list: readonly MissionSummary[], query: string): MissionSummary[] {
  const q = query.trim().toLocaleLowerCase();
  return q ? list.filter((m) => m.name.toLocaleLowerCase().includes(q)) : [...list];
}

/** The most recently opened mission, or null when none has been opened. */
export function pinnedMission(list: readonly MissionSummary[]): MissionSummary | null {
  let best: MissionSummary | null = null;
  for (const m of list) {
    if (m.lastOpenedAt !== null && (best === null || m.lastOpenedAt > (best.lastOpenedAt ?? 0))) best = m;
  }
  return best;
}

/** "18S UJ": the grid zone and 100 km square of a position, or null outside MGRS. */
export function mgrsSquare(center: LatLon): string | null {
  const mgrs = toMgrs(center, 1);
  if (!mgrs.ok) return null;
  const parts = splitMgrs(mgrs.value);
  return parts.ok ? `${parts.value.zoneBand} ${parts.value.square}` : null;
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export function formatMissionTotals(missions: number, units: number): string {
  return `${plural(missions, 'mission')} · ${plural(units, 'unit')} plotted`;
}

export function sortHeading(sort: MissionSort): string {
  return sort === 'name' ? 'BY NAME' : sort === 'most' ? 'MOST ITEMS' : 'EARLIER';
}
