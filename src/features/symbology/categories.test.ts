import { itemCategory, KNOWN_SIDCS, typeLabel } from './categories';
import { POINT_TYPES } from './point-types';
import { composeSidc, PRESET_SIDCS } from './presets';

describe('itemCategory', () => {
  it('is line for line items, point for point types and unit for everything else', () => {
    for (const t of POINT_TYPES) expect(itemCategory({ kind: 'point', sidc: t.sidc })).toBe('point');
    for (const sidc of PRESET_SIDCS) expect(itemCategory({ kind: 'point', sidc })).toBe('unit');
    expect(itemCategory({ kind: 'point', sidc: null })).toBe('unit');
    expect(itemCategory({ kind: 'line', sidc: null })).toBe('line');
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
