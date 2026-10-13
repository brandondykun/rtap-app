import { Q, type Database } from '@nozbe/watermelondb';
import { combineLatest, map, type Observable } from 'rxjs';

import { POINT_SIDCS } from '@/features/symbology/point-types';
import type { MapItem } from '@/lib/db/models/MapItem';
import type { Mission } from '@/lib/db/models/Mission';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import type { LatLon } from '@/lib/geo/types';

export type MissionCamera = { center: LatLon; zoom: number; bearing: number };

export type MissionSummary = {
  id: string;
  name: string;
  createdAt: number;
  lastOpenedAt: number | null;
};

export function sortMissionSummaries(list: MissionSummary[]): MissionSummary[] {
  return [...list].sort((a, b) => {
    if (a.lastOpenedAt !== b.lastOpenedAt) {
      if (a.lastOpenedAt === null) return 1;
      if (b.lastOpenedAt === null) return -1;
      return b.lastOpenedAt - a.lastOpenedAt;
    }
    return b.createdAt - a.createdAt;
  });
}

export function observeMissionSummaries(db: Database): Observable<MissionSummary[]> {
  const missions$ = db.get<Mission>(Tables.missions).query().observeWithColumns(['name']);
  const states$ = db
    .get<MissionViewState>(Tables.missionViewState)
    .query()
    .observeWithColumns(['last_opened_at']);
  return combineLatest([missions$, states$]).pipe(
    map(([missions, states]) => {
      const opened = new Map(states.map((s) => [s.missionId, s.lastOpenedAt]));
      return sortMissionSummaries(
        missions.map((m) => ({
          id: m.id,
          name: m.name,
          createdAt: m.createdAt.getTime(),
          lastOpenedAt: opened.get(m.id) ?? null,
        })),
      );
    }),
  );
}

/** Units, points, lines and polygons in a mission: lines and polygons by kind, points by symbol code (see itemCategory). */
export function observeMissionCategoryCounts(db: Database, missionId: string): Observable<{ units: number; points: number; lines: number; polygons: number }> {
  const items = db.get<MapItem>(Tables.mapItems);
  const inMission = Q.where('mission_id', missionId);
  return combineLatest([
    items.query(inMission, Q.where('kind', 'point')).observeCount(),
    items.query(inMission, Q.where('kind', 'point'), Q.where('sidc', Q.oneOf([...POINT_SIDCS]))).observeCount(),
    items.query(inMission, Q.where('kind', 'line')).observeCount(),
    items.query(inMission, Q.where('kind', 'polygon')).observeCount(),
  ]).pipe(map(([symbols, points, lines, polygons]) => ({ units: Math.max(0, symbols - points), points, lines, polygons })));
}

/** Returns null for unknown ids and for soft-deleted (markAsDeleted) missions. */
export async function findMission(db: Database, id: string): Promise<Mission | null> {
  let mission: Mission;
  try {
    mission = await db.get<Mission>(Tables.missions).find(id);
  } catch {
    return null;
  }
  if (mission._raw._status === 'deleted') return null;
  return mission;
}

export async function findMissionViewState(db: Database, missionId: string): Promise<MissionViewState | null> {
  const rows = await db
    .get<MissionViewState>(Tables.missionViewState)
    .query(Q.where('mission_id', missionId))
    .fetch();
  return rows[0] ?? null;
}

export function isValidCamera(value: unknown): value is MissionCamera {
  const c = value as MissionCamera | null;
  return (
    !!c &&
    typeof c === 'object' &&
    !!c.center &&
    [c.center.lat, c.center.lon, c.zoom, c.bearing].every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

export async function getMissionCamera(db: Database, missionId: string): Promise<MissionCamera | null> {
  const state = await findMissionViewState(db, missionId);
  if (!state?.camera) return null;
  try {
    const parsed: unknown = JSON.parse(state.camera);
    return isValidCamera(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function suggestMissionName(db: Database): Promise<string> {
  const count = await db.get<Mission>(Tables.missions).query().fetchCount();
  return `Mission ${count + 1}`;
}
