import { composeSidc } from '@/features/symbology/presets';

import { draftSidc } from './draft-sidc';

describe('draftSidc', () => {
  it('composes units from affiliation and type, and points from the point type', () => {
    expect(draftSidc({ category: 'unit', affiliation: 'hostile', unitType: 'armor', pointType: 'checkpoint' })).toBe(composeSidc('hostile', 'armor'));
    expect(draftSidc({ category: 'point', affiliation: 'hostile', unitType: 'armor', pointType: 'landing-zone' })).toBe('GFGPAAL-------X');
  });
});
