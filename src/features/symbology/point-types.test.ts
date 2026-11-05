import { drawSidcFor, LANDING_ZONE_SIDC, POINT_SIDCS, POINT_TYPES, pointTypeForSidc, pointTypePrefix, sidcForPointType } from './point-types';

describe('point types', () => {
  it('has the agreed types with their prefixes', () => {
    expect(POINT_TYPES.map((t) => [t.id, t.prefix])).toEqual([
      ['checkpoint', 'CP'],
      ['observation-post', 'OP'],
      ['landing-zone', 'LZ'],
      ['start-point', 'SP'],
      ['release-point', 'RP'],
      ['rally-point', 'RLY'],
      ['linkup-point', 'LU'],
      ['target-reference-point', 'TRP'],
      ['target', 'TGT'],
      ['coordination-point', 'CRD'],
      ['decision-point', 'DP'],
      ['waypoint', 'WP'],
      ['casualty-collection-point', 'CCP'],
      ['combat-outpost', 'COP'],
      ['forward-observer-position', 'FO'],
      ['key-terrain', 'KT'],
    ]);
  });

  it('round-trips every type through its SIDC', () => {
    for (const t of POINT_TYPES) {
      expect(sidcForPointType(t.id)).toBe(t.sidc);
      expect(pointTypeForSidc(t.sidc)).toBe(t.id);
      expect(pointTypePrefix(t.id)).toBe(t.prefix);
    }
    expect(new Set(POINT_SIDCS).size).toBe(POINT_TYPES.length);
    expect(LANDING_ZONE_SIDC).toBe('GFGPAAL-------X');
  });

  it('returns null for unit or unknown codes', () => {
    expect(pointTypeForSidc('SHGPUCI--------')).toBeNull();
    expect(pointTypeForSidc(null)).toBeNull();
    expect(pointTypeForSidc('nonsense')).toBeNull();
  });

  it('draws an artillery target with the TRP graphic for now', () => {
    const target = POINT_TYPES.find((t) => t.id === 'target')!;
    expect(target).toMatchObject({ label: 'Target', prefix: 'TGT', sidc: 'GFFPPTS-------X' });
    expect(drawSidcFor(target)).toBe('GFGPDPT-------X');
    expect(drawSidcFor(POINT_TYPES[0])).toBe(POINT_TYPES[0].sidc);
  });
});
