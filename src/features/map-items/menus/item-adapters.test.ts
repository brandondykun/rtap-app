import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';

import { observeMissionItems } from '../repository';
import { ITEM_ADAPTERS } from './item-adapters';

const AT = { lat: 38.9, lon: -77 };

beforeEach(() => useDraft.setState(INITIAL_DRAFT));

function artilleryDraft(threat: string) {
  const d = useDraft.getState();
  d.startAdd({ coord: AT, source: 'crosshair', category: 'unit', unitPreset: { affiliation: 'hostile', unitType: 'artillery' } });
  d.setName('ART-1');
  // Known elevation for this spot, so saving does no lookup.
  d.setElevation(AT, 10);
  d.setRangeText('threatRangeM', threat);
  return useDraft.getState();
}

describe('symbol adapter ranges', () => {
  it('cannot save an out-of-range threat ring', () => {
    expect(ITEM_ADAPTERS.unit.canSave(artilleryDraft('500001'))).toBe(false);
    expect(ITEM_ADAPTERS.unit.canSave(artilleryDraft('500000'))).toBe(true);
    expect(ITEM_ADAPTERS.unit.canSave(artilleryDraft(''))).toBe(true);
  });

  it('places the threat ring and loads it back on select', async () => {
    const ctx = makeTestContext();
    const r = await ITEM_ADAPTERS.unit.place(ctx, 'm1', artilleryDraft('18000'));
    expect(r.ok).toBe(true);
    const [item] = await firstValueFrom(observeMissionItems(ctx.db, 'm1'));
    expect(item).toMatchObject({ threatRangeM: 18000, horizontalRangeM: null, verticalRangeFt: null });
    expect(ITEM_ADAPTERS.unit.select(item)).toBe(true);
    expect(useDraft.getState().rangeText).toEqual({ threatRangeM: '18000', horizontalRangeM: '', verticalRangeFt: '' });
  });
});
