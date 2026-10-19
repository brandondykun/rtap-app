import { isKnownSidc, itemCategory, typeLabel } from './categories';
import { POINT_TYPES } from './point-types';
import { composeSidc, PRESET_SIDCS } from './presets';

describe('itemCategory', () => {
  it('is line for line items, point for point types and unit for everything else', () => {
    for (const t of POINT_TYPES) expect(itemCategory({ kind: 'point', sidc: t.sidc })).toBe('point');
    for (const sidc of PRESET_SIDCS) expect(itemCategory({ kind: 'point', sidc })).toBe('unit');
    expect(itemCategory({ kind: 'point', sidc: null })).toBe('unit');
    expect(itemCategory({ kind: 'line', sidc: null })).toBe('line');
    expect(itemCategory({ kind: 'polygon', sidc: null })).toBe('polygon');
  });

  it('knows every composable unit SIDC (any echelon) and every point type', () => {
    expect(isKnownSidc('SFGPUCI----E---')).toBe(true);
    expect(isKnownSidc('SHGPU----------')).toBe(true);
    expect(isKnownSidc('GFGPGPPK------X')).toBe(true);
    expect(isKnownSidc('XYZ')).toBe(false);
    for (const sidc of PRESET_SIDCS) expect(isKnownSidc(sidc)).toBe(true);
    for (const t of POINT_TYPES) expect(isKnownSidc(t.sidc)).toBe(true);
  });

  it('labels the type of units and points', () => {
    expect(typeLabel('GFGPGPPK------X')).toBe('Checkpoint');
    expect(typeLabel(composeSidc('hostile', 'infantry'))).toBe('Infantry');
    expect(typeLabel(null)).toBeNull();
  });
});
