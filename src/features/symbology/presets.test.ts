import { AFFILIATIONS, DEFAULT_SIDC, ECHELONS, PRESET_SIDCS, UNIT_TYPES, affiliationOf, composeSidc, decomposeSidc } from './presets';

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

  it('round-trips every type, affiliation and echelon', () => {
    for (const a of AFFILIATIONS) {
      for (const t of UNIT_TYPES) {
        for (const e of ECHELONS) {
          const sidc = composeSidc(a, t.id, e.id);
          expect(decomposeSidc(sidc)).toEqual({ affiliation: a, unitType: t.id, echelon: e.id });
          expect(affiliationOf(sidc)).toBe(a);
        }
      }
    }
  });

  it.each([
    ['friend', 'field-artillery-observer', 'squad', '10031000121304000000'],
    ['hostile', 'joint-fire-support', 'platoon', '10061000141305000000'],
    ['neutral', 'sniper', 'unspecified', '10041000001215000000'],
    ['unknown', 'sniper', 'division', '10011000211215000000'],
    ['friend', 'sniper', 'command', '10031000261215000000'],
  ] as const)('gives a type 2525C lacks a 2525D land unit SIDC: %s %s %s → %s', (affiliation, unitType, echelon, sidc) => {
    expect(composeSidc(affiliation, unitType, echelon)).toBe(sidc);
  });

  it('reads no 2525D code but a present land unit of a type it offers', () => {
    expect(decomposeSidc('10031000121304000000')).not.toBeNull();
    expect(decomposeSidc('10032500001321000000')).toBeNull(); // key terrain: a control measure
    expect(decomposeSidc('10031010121304000000')).toBeNull(); // planned, not present
    expect(decomposeSidc('10031000121211000000')).toBeNull(); // 2525D infantry: offered as 2525C
  });

  it('returns null for unknown codes', () => {
    expect(decomposeSidc('SFGPEVAT-------')).toBeNull();
    expect(decomposeSidc('nope')).toBeNull();
  });

  it('lists 64 unique presets (16 types × 4 affiliations) including the default', () => {
    expect(new Set(PRESET_SIDCS).size).toBe(64);
    expect(PRESET_SIDCS).toContain(DEFAULT_SIDC);
  });

  it('offers Artillery and Air defense', () => {
    expect(UNIT_TYPES.map((t) => t.label)).toEqual(expect.arrayContaining(['Artillery', 'Air defense']));
  });
});

describe('echelon', () => {
  it('lists Unspecified then Team up to Command with their 2525C codes', () => {
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
      ['corps', 'Corps/MEF', '-J'],
      ['army', 'Army', '-K'],
      ['army-group', 'Army Group/Front', '-L'],
      ['region', 'Region/Theater', '-M'],
      ['command', 'Command', '-N'],
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

  it('reads an echelon it does not offer (a mobility amplifier) as unspecified, and rejects non-unit codes', () => {
    expect(decomposeSidc('SFGPUCI---MO---')).toEqual({ affiliation: 'friend', unitType: 'infantry', echelon: 'unspecified' });
    expect(decomposeSidc('GFGPGPPK------X')).toBeNull();
    expect(decomposeSidc('SFGPUCI')).toBeNull();
  });
});
