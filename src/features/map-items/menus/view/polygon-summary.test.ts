import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';

import { placePolygon } from '../../commands';
import { observeItem, type MapItemSnapshot } from '../../repository';
import { polygonSummary } from './polygon-summary';

const C = { lat: 38.9, lon: -77 };
const SQUARE = [C, { lat: 38.91, lon: -77 }, { lat: 38.91, lon: -76.99 }, { lat: 38.9, lon: -76.99 }];

async function make(shape: Parameters<typeof placePolygon>[1]['shape']) {
  const ctx = makeTestContext();
  const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: 'OBJ-1', shape });
  if (!r.ok) throw new Error('setup');
  return (await firstValueFrom(observeItem(ctx.db, r.value.id))) as MapItemSnapshot;
}

describe('polygonSummary', () => {
  it('summarizes a points polygon', async () => {
    const s = polygonSummary(await make({ kind: 'points', points: SQUARE }))!;
    expect(s.kind).toBe('points');
    expect(s.points).toHaveLength(4);
    expect(s.perimeterM).toBeGreaterThan(0);
    expect(s.radiusM).toBeNull();
    expect(s.areaM2).toBeGreaterThan(0);
    expect(s.typeLabel).toBe('Objective');
    expect(s.subtitle).toBe('Objective · 4 points · 15% fill');
  });

  it('summarizes a circle by its exact center and radius', async () => {
    const s = polygonSummary(await make({ kind: 'circle', center: C, radiusM: 500 }))!;
    expect(s.kind).toBe('circle');
    expect(s.radiusM).toBe(500);
    expect(s.perimeterM).toBeNull();
    expect(s.center).toEqual(C);
    expect(s.areaM2).toBeGreaterThan(700_000);
    expect(s.subtitle).toBe('Objective · 15% fill');
  });

  it('is null when the geometry cannot be read', async () => {
    const item = await make({ kind: 'points', points: SQUARE });
    expect(polygonSummary({ ...item, geometry: 'nope' })).toBeNull();
  });
});
