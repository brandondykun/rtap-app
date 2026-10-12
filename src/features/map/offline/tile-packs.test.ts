import { createTilePackService, type TilePackProgress } from './tile-packs';

jest.mock('@rnmapbox/maps');

const BOUNDS = { north: 39, south: 38.8, east: -76.9, west: -77.1 };

function fakeManager() {
  return { createPack: jest.fn(async () => {}), getPacks: jest.fn(async () => []), deletePack: jest.fn(async () => {}) };
}

describe('TilePackService', () => {
  it('creates a pack with Mapbox bounds order and reports progress', async () => {
    const manager = fakeManager();
    const service = createTilePackService(manager as never, 'style://sat', () => 'pack-1');
    const events: TilePackProgress[] = [];
    service.progress$.subscribe((e) => events.push(e));

    expect(await service.create(BOUNDS, 10, 16)).toEqual({ ok: true, value: { id: 'pack-1' } });
    const [options, onProgress, onError] = manager.createPack.mock.calls[0] as unknown as [
      Record<string, unknown>,
      (pack: unknown, status: { state: string; percentage: number; completedResourceCount: number }) => void,
      (pack: unknown, error: { name: string; message: string }) => void,
    ];
    expect(options).toMatchObject({ name: 'pack-1', styleURL: 'style://sat', bounds: [[-76.9, 39], [-77.1, 38.8]], minZoom: 10, maxZoom: 16 });

    onProgress({}, { state: 'active', percentage: 40, completedResourceCount: 12 });
    onProgress({}, { state: 'complete', percentage: 100, completedResourceCount: 30 });
    onError({}, { name: 'pack-1', message: 'network' });
    expect(events).toEqual([
      { id: 'pack-1', state: 'active', percentage: 40, completedResources: 12 },
      { id: 'pack-1', state: 'complete', percentage: 100, completedResources: 30 },
      { id: 'pack-1', state: 'error', percentage: 0, completedResources: 0, error: 'network' },
    ]);
  });

  it.each([
    [{ ...BOUNDS, north: 38 }, 10, 16],
    [{ ...BOUNDS, west: -76 }, 10, 16],
    [{ ...BOUNDS, north: Number.NaN }, 10, 16],
    [{ ...BOUNDS, north: 95 }, 10, 16],
    [BOUNDS, 16, 10],
    [BOUNDS, -1, 10],
    [BOUNDS, 10, 23],
  ])('rejects invalid bounds or zoom (%p, %p, %p)', async (bounds, minZoom, maxZoom) => {
    const manager = fakeManager();
    const service = createTilePackService(manager as never, 'style://sat', () => 'x');
    expect(await service.create(bounds, minZoom, maxZoom)).toMatchObject({ ok: false, error: 'invalid_bounds' });
    expect(manager.createPack).not.toHaveBeenCalled();
  });

  it('wraps create and delete failures', async () => {
    const manager = fakeManager();
    manager.createPack.mockRejectedValueOnce(new Error('disk full'));
    manager.deletePack.mockRejectedValueOnce(new Error('nope'));
    const service = createTilePackService(manager as never, 'style://sat', () => 'x');
    expect(await service.create(BOUNDS, 10, 12)).toMatchObject({ ok: false, error: 'create_failed' });
    expect(await service.delete('x')).toMatchObject({ ok: false, error: 'delete_failed' });
  });

  it('lists and deletes packs by id', async () => {
    const manager = fakeManager();
    manager.getPacks.mockResolvedValueOnce([{ name: 'pack-1', metadata: { createdAt: 'x' } }] as never);
    const service = createTilePackService(manager as never, 'style://sat', () => 'x');
    expect(await service.list()).toEqual([{ id: 'pack-1', metadata: { createdAt: 'x' } }]);
    expect(await service.delete('pack-1')).toEqual({ ok: true, value: undefined });
    expect(manager.deletePack).toHaveBeenCalledWith('pack-1');
  });
});
