import { combineLatest, distinctUntilChanged, map, of, type Observable } from 'rxjs';

import { POINT_SIDCS } from '@/features/symbology/point-types';
import type { AppDb, AppDbTx } from '@/lib/db/app-db';
import { Tables } from '@/lib/db/schema';
import type { LatLon } from '@/lib/geo/types';

export type MissionRecord = { id: string; name: string; createdBy: string; createdAt: number; updatedAt: number };

/** Local-only: when this device last opened a mission and where its camera was. */
export type MissionViewStateRecord = {
  id: string;
  missionId: string;
  lastOpenedAt: number;
  /** JSON `MissionCamera` or null. */
  camera: string | null;
  /** JSON `MissionSnapshot` (this device's map picture) or null. */
  snapshot: string | null;
  updatedAt: number;
};

type MissionRow = { id: string; name: string; created_by: string; created_at: number; updated_at: number };
type MissionViewStateRow = { id: string; mission_id: string; last_opened_at: number; camera: string | null; snapshot: string | null; updated_at: number };

export type MissionCamera = { center: LatLon; zoom: number; bearing: number };

/** A picture of the mission map stored on this device. */
export type MissionSnapshot = { uri: string; takenAt: number };

export type CategoryCounts = { units: number; points: number; lines: number; polygons: number };

export type MissionSummary = {
  id: string;
  name: string;
  createdAt: number;
  lastOpenedAt: number | null;
  camera: MissionCamera | null;
  snapshot: MissionSnapshot | null;
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

type SummaryRow = { id: string; name: string; created_at: number; last_opened_at: number | null; camera: string | null; snapshot: string | null };

const summaryKey = (rows: readonly SummaryRow[]) =>
  rows.map((r) => [r.id, r.name, r.last_opened_at, r.camera, r.snapshot].join('\u0000')).join('\u0001');

export function observeMissionSummaries(db: AppDb): Observable<MissionSummary[]> {
  return db
    .watch<SummaryRow>(
      `SELECT m.id, m.name, m.created_at, s.last_opened_at, s.camera, s.snapshot
       FROM missions m LEFT JOIN mission_view_state s ON s.mission_id = m.id`,
      [],
      [Tables.missions, Tables.missionViewState],
    )
    .pipe(
      distinctUntilChanged((a, b) => summaryKey(a) === summaryKey(b)),
      map((rows) =>
        sortMissionSummaries(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            createdAt: r.created_at,
            lastOpenedAt: r.last_opened_at ?? null,
            camera: parseCamera(r.camera ?? null),
            snapshot: parseSnapshot(r.snapshot ?? null),
          })),
        ),
      ),
    );
}

const POINT_SIDC_LIST = `(${POINT_SIDCS.map(() => '?').join(', ')})`;
type CountsRow = { symbols: number | null; points: number | null; lines: number | null; polygons: number | null };

/** Units, points, lines and polygons in a mission: lines and polygons by kind, points by symbol code (see itemCategory). */
export function observeMissionCategoryCounts(db: AppDb, missionId: string): Observable<CategoryCounts> {
  return db
    .watch<CountsRow>(
      `SELECT
         SUM(CASE WHEN kind = 'point' THEN 1 ELSE 0 END) AS symbols,
         SUM(CASE WHEN kind = 'point' AND sidc IN ${POINT_SIDC_LIST} THEN 1 ELSE 0 END) AS points,
         SUM(CASE WHEN kind = 'line' THEN 1 ELSE 0 END) AS lines,
         SUM(CASE WHEN kind = 'polygon' THEN 1 ELSE 0 END) AS polygons
       FROM map_items WHERE mission_id = ?`,
      [...POINT_SIDCS, missionId],
      [Tables.mapItems],
    )
    .pipe(
      map(([row]) => {
        // SUM over no rows is NULL.
        const symbols = row?.symbols ?? 0;
        const points = row?.points ?? 0;
        return { units: Math.max(0, symbols - points), points, lines: row?.lines ?? 0, polygons: row?.polygons ?? 0 };
      }),
      distinctUntilChanged((a, b) => a.units === b.units && a.points === b.points && a.lines === b.lines && a.polygons === b.polygons),
    );
}

/** Category counts for each mission id (for sorting by size and the units total). */
export function observeCountsByMission(db: AppDb, ids: readonly string[]): Observable<ReadonlyMap<string, CategoryCounts>> {
  if (ids.length === 0) return of(new Map());
  return combineLatest(ids.map((id) => observeMissionCategoryCounts(db, id))).pipe(
    map((counts) => new Map(ids.map((id, i) => [id, counts[i]]))),
  );
}

/** Returns null for unknown or deleted ids. Takes a transaction handle too, for reads inside a write. */
export async function findMission(db: AppDbTx, id: string): Promise<MissionRecord | null> {
  const r = await db.getOptional<MissionRow>('SELECT * FROM missions WHERE id = ?', [id]);
  return r ? { id: r.id, name: r.name, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at } : null;
}

export async function findMissionViewState(db: AppDbTx, missionId: string): Promise<MissionViewStateRecord | null> {
  const r = await db.getOptional<MissionViewStateRow>('SELECT * FROM mission_view_state WHERE mission_id = ? LIMIT 1', [missionId]);
  return r
    ? { id: r.id, missionId: r.mission_id, lastOpenedAt: r.last_opened_at, camera: r.camera ?? null, snapshot: r.snapshot ?? null, updatedAt: r.updated_at }
    : null;
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

export function parseCamera(json: string | null): MissionCamera | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return isValidCamera(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseSnapshot(json: string | null): MissionSnapshot | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json) as MissionSnapshot | null;
    return s && typeof s.uri === 'string' && s.uri.length > 0 && typeof s.takenAt === 'number' && Number.isFinite(s.takenAt)
      ? { uri: s.uri, takenAt: s.takenAt }
      : null;
  } catch {
    return null;
  }
}

export async function getMissionCamera(db: AppDb, missionId: string): Promise<MissionCamera | null> {
  const state = await findMissionViewState(db, missionId);
  return parseCamera(state?.camera ?? null);
}

export async function suggestMissionName(db: AppDb): Promise<string> {
  const row = await db.getOptional<{ n: number }>('SELECT COUNT(*) AS n FROM missions');
  return `Mission ${(row?.n ?? 0) + 1}`;
}
