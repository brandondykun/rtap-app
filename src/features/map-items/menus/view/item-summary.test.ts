import { composeSidc } from '@/features/symbology/presets';

import type { MapItemSnapshot } from '../../repository';
import { pointSubtitle, ringSummary, unitSubtitle } from './item-summary';

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
  it('artillery', () => expect(ringSummary(unit(composeSidc('hostile', 'artillery'), { threatRangeM: 800 }))).toBe('800 m'));
  it('air defense', () => expect(ringSummary(unit(composeSidc('hostile', 'air-defense'), { horizontalRangeM: 1200, verticalRangeFt: 900 }))).toBe('↔ 1200 m · ↕ 900 ft ceiling'));
  it('air defense vertical only', () => expect(ringSummary(unit(composeSidc('hostile', 'air-defense'), { verticalRangeFt: 900 }))).toBe('↕ 900 ft ceiling'));
  it('nothing set', () => expect(ringSummary(unit(composeSidc('hostile', 'artillery')))).toBe('No range set — Edit to add'));
  it('null for non-ring units', () => expect(ringSummary(unit(composeSidc('friend', 'recon'), { threatRangeM: 5 }))).toBeNull());
});
