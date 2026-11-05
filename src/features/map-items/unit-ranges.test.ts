import { composeSidc } from '@/features/symbology/presets';
import {
  formatRangeText,
  isValidRange,
  normalizeRanges,
  parseRangeText,
  rangeFieldsFor,
  rangeFieldsForSidc,
  ringRadiusM,
} from './unit-ranges';

describe('unit ranges', () => {
  it('rangeFieldsFor maps unit types to fields', () => {
    expect(rangeFieldsFor('artillery')).toEqual(['threatRangeM']);
    expect(rangeFieldsFor('mortar')).toEqual(['threatRangeM']);
    expect(rangeFieldsFor('air-defense')).toEqual(['horizontalRangeM', 'verticalRangeFt']);
    expect(rangeFieldsFor('infantry')).toEqual([]);
  });

  it('parseRangeText', () => {
    expect(parseRangeText('')).toBeNull();
    expect(parseRangeText(' ')).toBeNull();
    expect(parseRangeText('800')).toBe(800);
    expect(parseRangeText(' 800 ')).toBe(800);
    expect(parseRangeText('12,6')).toBe(13);
    expect(parseRangeText('abc')).toBeUndefined();
    expect(parseRangeText('1e3')).toBe(1000);
  });

  it('formatRangeText', () => {
    expect(formatRangeText(null)).toBe('');
    expect(formatRangeText(800)).toBe('800');
  });

  it('isValidRange', () => {
    expect(isValidRange('threatRangeM', 0)).toBe(false);
    expect(isValidRange('threatRangeM', -5)).toBe(false);
    expect(isValidRange('threatRangeM', 500_000)).toBe(true);
    expect(isValidRange('threatRangeM', 500_001)).toBe(false);
    expect(isValidRange('verticalRangeFt', 100_000)).toBe(true);
    expect(isValidRange('verticalRangeFt', 100_001)).toBe(false);
    expect(isValidRange('threatRangeM', null)).toBe(true);
    expect(isValidRange('threatRangeM', 1.5)).toBe(false);
  });

  it('normalizeRanges keeps only the given fields', () => {
    expect(normalizeRanges(['threatRangeM'], { threatRangeM: 1, horizontalRangeM: 2, verticalRangeFt: 3 })).toEqual({
      threatRangeM: 1,
      horizontalRangeM: null,
      verticalRangeFt: null,
    });
  });

  it('rangeFieldsForSidc', () => {
    expect(rangeFieldsForSidc(composeSidc('hostile', 'artillery'))).toEqual(['threatRangeM']);
    expect(rangeFieldsForSidc(composeSidc('hostile', 'air-defense'))).toEqual(['horizontalRangeM', 'verticalRangeFt']);
    expect(rangeFieldsForSidc(composeSidc('hostile', 'infantry'))).toEqual([]);
    expect(rangeFieldsForSidc(null)).toEqual([]);
  });

  it('ringRadiusM', () => {
    expect(ringRadiusM({ sidc: composeSidc('hostile', 'artillery'), threatRangeM: 18000, horizontalRangeM: null })).toBe(18000);
    expect(ringRadiusM({ sidc: composeSidc('friend', 'mortar'), threatRangeM: 5600, horizontalRangeM: null })).toBe(5600);
    expect(ringRadiusM({ sidc: composeSidc('hostile', 'air-defense'), threatRangeM: null, horizontalRangeM: 8000 })).toBe(8000);
    expect(ringRadiusM({ sidc: composeSidc('hostile', 'infantry'), threatRangeM: 5, horizontalRangeM: null })).toBeNull();
  });
});
