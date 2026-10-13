import { itemCategory, KNOWN_SIDCS, typeLabel } from './categories';
import { POINT_TYPES } from './point-types';
import { composeSidc, PRESET_SIDCS } from './presets';

describe('itemCategory', () => {
  it('is point for every point type and unit for everything else', () => {
    for (const t of POINT_TYPES) expect(itemCategory(t.sidc)).toBe('point');
    for (const sidc of PRESET_SIDCS) expect(itemCategory(sidc)).toBe('unit');
    expect(itemCategory(null)).toBe('unit');
    expect(itemCategory('garbage')).toBe('unit');
  });

  it('knows every unit preset and point SIDC', () => {
    expect(KNOWN_SIDCS.size).toBe(PRESET_SIDCS.length + POINT_TYPES.length);
  });

  it('labels the type of units and points', () => {
    expect(typeLabel('GFGPGPPK------X')).toBe('Checkpoint');
    expect(typeLabel(composeSidc('hostile', 'infantry'))).toBe('Infantry');
    expect(typeLabel(null)).toBeNull();
  });
});
