import { offlineManager } from '@rnmapbox/maps';
import * as Crypto from 'expo-crypto';
import { Subject, type Observable } from 'rxjs';

import { err, ok, type Result } from '@/lib/result';

import { MAP_STYLE_URL } from '../canvas/mapbox';

export type TilePackBounds = { north: number; south: number; east: number; west: number };
export type TilePackProgress = {
  id: string;
  state: 'active' | 'complete' | 'error';
  percentage: number;
  completedResources: number;
  error?: string;
};
export type TilePackInfo = { id: string; metadata: Record<string, unknown> | null };

export interface TilePackService {
  create(bounds: TilePackBounds, minZoom: number, maxZoom: number): Promise<Result<{ id: string }, 'invalid_bounds' | 'create_failed'>>;
  list(): Promise<TilePackInfo[]>;
  delete(id: string): Promise<Result<void, 'delete_failed'>>;
  progress$: Observable<TilePackProgress>;
}

type OfflineManagerLike = Pick<typeof offlineManager, 'createPack' | 'getPacks' | 'deletePack'>;

const MAX_ZOOM = 22;

function isValidBounds(b: TilePackBounds): boolean {
  const all = [b.north, b.south, b.east, b.west];
  return (
    all.every(Number.isFinite) &&
    b.south >= -90 && b.north <= 90 && b.south < b.north &&
    // No antimeridian crossing in MVP.
    b.west >= -180 && b.east <= 180 && b.west < b.east
  );
}

function isValidZoomRange(min: number, max: number): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= MAX_ZOOM && min <= max;
}

/** Offline tile downloads over Mapbox's offline manager. Built and tested; no UI in MVP. */
export function createTilePackService(
  manager: OfflineManagerLike = offlineManager,
  styleURL: string = MAP_STYLE_URL,
  newId: () => string = Crypto.randomUUID,
): TilePackService {
  const progress = new Subject<TilePackProgress>();
  return {
    progress$: progress.asObservable(),

    async create(bounds, minZoom, maxZoom) {
      if (!isValidBounds(bounds) || !isValidZoomRange(minZoom, maxZoom)) {
        return err('invalid_bounds', 'Bounds or zoom range are invalid');
      }
      const id = newId();
      try {
        await manager.createPack(
          {
            name: id,
            styleURL,
            bounds: [
              [bounds.east, bounds.north],
              [bounds.west, bounds.south],
            ],
            minZoom,
            maxZoom,
            metadata: { createdAt: new Date().toISOString() },
          },
          (_pack, status) =>
            progress.next({
              id,
              state: status.state === 'complete' ? 'complete' : 'active',
              percentage: status.percentage ?? 0,
              completedResources: 'completedResourceCount' in status ? status.completedResourceCount : 0,
            }),
          (_pack, error) => progress.next({ id, state: 'error', percentage: 0, completedResources: 0, error: error.message }),
        );
        return ok({ id });
      } catch (e) {
        return err('create_failed', String(e));
      }
    },

    async list() {
      const packs = await manager.getPacks();
      return packs.map((pack) => ({ id: String(pack.name), metadata: (pack.metadata as Record<string, unknown>) ?? null }));
    },

    async delete(id) {
      try {
        await manager.deletePack(id);
        return ok(undefined);
      } catch (e) {
        return err('delete_failed', String(e));
      }
    },
  };
}
