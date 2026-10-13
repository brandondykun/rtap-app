import { AFFILIATIONS, DEFAULT_SIDC, PRESET_SIDCS, UNIT_TYPES, composeSidc, decomposeSidc } from './presets';

describe('SIDC presets (MIL-STD-2525C)', () => {
  it.each([
    ['hostile', 'infantry', 'SHGPUCI--------'],
    ['friend', 'recon', 'SFGPUCR--------'],
    ['neutral', 'armor', 'SNGPUCA--------'],
    ['unknown', 'unspecified', 'SUGPU----------'],
    ['friend', 'medical', 'SFGPUSM--------'],
    ['hostile', 'engineer', 'SHGPUCE--------'],
    ['friend', 'artillery', 'SFGPUCF--------'],
    ['hostile', 'air-defense', 'SHGPUCD--------'],
  ] as const)('%s %s → %s', (affiliation, unitType, sidc) => {
    expect(composeSidc(affiliation, unitType)).toBe(sidc);
    expect(composeSidc(affiliation, unitType)).toHaveLength(15);
  });

  it('round-trips every preset', () => {
    for (const a of AFFILIATIONS) {
      for (const t of UNIT_TYPES) {
        expect(decomposeSidc(composeSidc(a, t.id))).toEqual({ affiliation: a, unitType: t.id });
      }
    }
  });

  it('returns null for unknown codes', () => {
    expect(decomposeSidc('SFGPEVAT-------')).toBeNull();
    expect(decomposeSidc('nope')).toBeNull();
  });

  it('lists 32 unique presets including the default', () => {
    expect(new Set(PRESET_SIDCS).size).toBe(32);
    expect(PRESET_SIDCS).toContain(DEFAULT_SIDC);
  });

  it('offers Artillery and Air defense', () => {
    expect(UNIT_TYPES.map((t) => t.label)).toEqual(expect.arrayContaining(['Artillery', 'Air defense']));
  });
});
