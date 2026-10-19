import { composeSidc } from '@/features/symbology/presets';

import { draftSidc } from './draft-sidc';

describe('draftSidc', () => {
  it('composes units from affiliation and type, and points from the point type', () => {
    expect(draftSidc({ category: 'unit', affiliation: 'hostile', unitType: 'armor', echelon: 'unspecified', pointType: 'checkpoint' })).toBe(composeSidc('hostile', 'armor'));
    expect(draftSidc({ category: 'point', affiliation: 'hostile', unitType: 'armor', echelon: 'unspecified', pointType: 'landing-zone' })).toBe('GFGPAAL-------X');
  });

  it('includes the unit echelon', () => {
    expect(draftSidc({ category: 'unit', affiliation: 'friend', unitType: 'infantry', echelon: 'platoon', pointType: 'checkpoint' })).toBe('SFGPUCI----D---');
  });
});
