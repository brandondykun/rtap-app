import { mapColors } from '@/theme/tokens';

import { composeSidc, ECHELONS } from '../presets';
import { LANDING_ZONE_SIDC } from '../point-types';
import { isPointSidc, symbolSvg } from './symbol-svg';

const colors = mapColors('dark');

describe('symbolSvg', () => {
  it('fills units by affiliation', () => {
    expect(symbolSvg(composeSidc('friend', 'infantry'))).toContain(colors.friendly);
    expect(symbolSvg(composeSidc('hostile', 'infantry'))).toContain(colors.hostile);
    expect(symbolSvg(composeSidc('neutral', 'infantry'))).toContain(colors.neutral);
    expect(symbolSvg(composeSidc('unknown', 'infantry'))).toContain(colors.unknown);
  });

  it('draws an echelon marking above the frame for every echelon but unspecified', () => {
    const plain = symbolSvg(composeSidc('friend', 'infantry'));
    for (const e of ECHELONS.filter((x) => x.id !== 'unspecified')) {
      expect(symbolSvg(composeSidc('friend', 'infantry', e.id))).not.toBe(plain);
    }
  });

  it('draws any SIDC milsymbol knows, even one the app never composes (Corps)', () => {
    expect(() => symbolSvg('SFGPUCI----J---')).not.toThrow();
    expect(symbolSvg('SFGPUCI----J---')).toMatch(/^<svg/);
  });

  it('centers point graphics on their anchor and draws the LZ by hand', () => {
    expect(isPointSidc('GFGPGPPK------X')).toBe(true);
    expect(isPointSidc(composeSidc('friend', 'armor'))).toBe(false);
    const checkpoint = symbolSvg('GFGPGPPK------X');
    expect(checkpoint).toContain('<g transform="translate(');
    expect(checkpoint).toContain(colors['point-symbol-halo']);
    expect(symbolSvg(LANDING_ZONE_SIDC)).toContain('>LZ</text>');
  });
});
