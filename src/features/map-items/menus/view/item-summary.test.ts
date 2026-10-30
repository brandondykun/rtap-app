import { composeSidc } from '@/features/symbology/presets';

import type { MapItemSnapshot } from '../../repository';
import { itemAccessibleTitle, pointSubtitle, ringSummary, unitSubtitle } from './item-summary';

function unit(sidc: string, o: Partial<MapItemSnapshot> = {}): MapItemSnapshot {
  return { id: 'i1', kind: 'point', geometry: '', sidc, style: null, name: 'N', notes: null, elevationM: null, threatRangeM: null, horizontalRangeM: null, verticalRangeFt: null, updatedAt: 0, ...o };
}

describe('unitSubtitle', () => {
  it('joins affiliation, type and echelon', () => {
    expect(unitSubtitle(composeSidc('hostile', 'armor', 'platoon'))).toEqual({ affiliation: 'hostile', text: 'Hostile · Armor · Platoon' });
  });
  it('includes Unspecified', () => {
    expect(unitSubtitle(composeSidc('friend', 'unspecified')).text).toBe('Friendly · Unspecified · Unspecified');
  });
  it('is Unknown for an unreadable sidc', () => {
    expect(unitSubtitle('nonsense')).toEqual({ affiliation: null, text: 'Unknown' });
    expect(unitSubtitle(null)).toEqual({ affiliation: null, text: 'Unknown' });
  });
});

describe('pointSubtitle', () => {
  it('falls back to Unknown', () => expect(pointSubtitle(null)).toBe('Unknown'));
});

describe('ringSummary', () => {
  it('artillery: one ring', () => expect(ringSummary(unit(composeSidc('hostile', 'artillery'), { threatRangeM: 800 }))).toEqual({ title: 'RANGE RING', text: '800 m' }));
  it('air defense with both ranges: rings, plural', () =>
    expect(ringSummary(unit(composeSidc('hostile', 'air-defense'), { horizontalRangeM: 1200, verticalRangeFt: 900 }))).toEqual({ title: 'RANGE RINGS', text: '↔ 1200 m · ↕ 900 ft' }));
  it('air defense with one range: singular', () => {
    expect(ringSummary(unit(composeSidc('hostile', 'air-defense'), { verticalRangeFt: 900 }))).toEqual({ title: 'RANGE RING', text: '↕ 900 ft' });
    expect(ringSummary(unit(composeSidc('hostile', 'air-defense'), { horizontalRangeM: 1200 }))).toEqual({ title: 'RANGE RING', text: '↔ 1200 m' });
  });
  it('nothing set', () => expect(ringSummary(unit(composeSidc('hostile', 'artillery')))).toEqual({ title: 'RANGE RING', text: 'No range set — Edit to add' }));
  it('null for non-ring units', () => expect(ringSummary(unit(composeSidc('friend', 'recon'), { threatRangeM: 5 }))).toBeNull());
});

describe('itemAccessibleTitle', () => {
  it('names a unit with its subtitle and hidden state', () => {
    const u = unit(composeSidc('hostile', 'armor', 'platoon'), { name: 'OBJ' });
    expect(itemAccessibleTitle('unit', u, false)).toBe('OBJ, Hostile · Armor · Platoon');
    expect(itemAccessibleTitle('unit', u, true)).toBe('OBJ, Hostile · Armor · Platoon, hidden');
  });
});
