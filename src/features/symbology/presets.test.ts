import { AFFILIATIONS, DEFAULT_SIDC, ECHELONS, PRESET_SIDCS, UNIT_TYPES, composeSidc, decomposeSidc } from './presets';

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
        expect(decomposeSidc(composeSidc(a, t.id))).toEqual({ affiliation: a, unitType: t.id, echelon: 'unspecified' });
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

describe('echelon', () => {
  it('lists Unspecified then Team up to Division with their 2525C codes', () => {
    expect(ECHELONS.map((e) => [e.id, e.label, e.code])).toEqual([
      ['unspecified', 'Unspecified', '--'],
      ['team', 'Team', '-A'],
      ['squad', 'Squad', '-B'],
      ['section', 'Section', '-C'],
      ['platoon', 'Platoon', '-D'],
      ['company', 'Company', '-E'],
      ['battalion', 'Battalion', '-F'],
      ['regiment', 'Regiment', '-G'],
      ['brigade', 'Brigade', '-H'],
      ['division', 'Division', '-I'],
    ]);
  });

  it('puts the echelon in positions 11-12 and defaults to unspecified', () => {
    expect(composeSidc('friend', 'infantry', 'company')).toBe('SFGPUCI----E---');
    expect(composeSidc('hostile', 'armor')).toBe('SHGPUCA--------');
  });

  it('round-trips every echelon and reads stored SIDCs without one as unspecified', () => {
    for (const e of ECHELONS) expect(decomposeSidc(composeSidc('neutral', 'recon', e.id))).toEqual({ affiliation: 'neutral', unitType: 'recon', echelon: e.id });
    expect(decomposeSidc('SUGPU----------')).toEqual({ affiliation: 'unknown', unitType: 'unspecified', echelon: 'unspecified' });
  });

  it('reads an echelon it does not offer (Corps) as unspecified, and rejects non-unit codes', () => {
    expect(decomposeSidc('SFGPUCI----J---')).toEqual({ affiliation: 'friend', unitType: 'infantry', echelon: 'unspecified' });
    expect(decomposeSidc('GFGPGPPK------X')).toBeNull();
    expect(decomposeSidc('SFGPUCI')).toBeNull();
  });
});
