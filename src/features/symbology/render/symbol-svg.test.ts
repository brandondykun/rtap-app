import ms from 'milsymbol';

import { mapColors } from '@/theme/tokens';

import { composeSidc, ECHELONS } from '../presets';
import { LANDING_ZONE_SIDC, POINT_TYPES } from '../point-types';
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

  // Skia's SVG module ignores dominant-baseline and paint-order: the output must not rely on them.
  it('moves middle-baseline labels down by 0.35em instead of using dominant-baseline', () => {
    for (const t of POINT_TYPES) expect(symbolSvg(t.sidc)).not.toContain('dominant-baseline');
    const labels = symbolSvg('GFGPGPPK------X').match(/<text[^>]*>CKP<\/text>/g)!;
    expect(labels).toHaveLength(2);
    // milsymbol: y="-30" font-size="35" with a middle baseline → baseline at -30 + 0.35 × 35.
    for (const label of labels) expect(label).toContain('y="-17.75"');
  });

  it('draws the LZ halo as its own stroke-only text under a fill-only text', () => {
    const lz = symbolSvg(LANDING_ZONE_SIDC);
    expect(lz).not.toContain('paint-order');
    const texts = lz.match(/<text[^>]*>LZ<\/text>/g)!;
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain('fill="none"');
    expect(texts[0]).toContain(`stroke="${colors['point-symbol-halo']}"`);
    expect(texts[1]).toContain(`fill="${colors.friendly}"`);
    expect(texts[1]).not.toMatch(/stroke=/);
  });

  // Mapbox centers an image on its coordinate, so the image center must be where the symbol marks the spot.
  function outer(svg: string) {
    const [, w, h] = /^<svg [^>]*width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.map(Number);
    const [, tx, ty] = /<g transform="translate\((-?[\d.e-]+) (-?[\d.e-]+)\)">/.exec(svg)!.map(Number);
    return { w, h, tx, ty };
  }

  it('centers a unit with an echelon on its anchor, not on its taller image', () => {
    const sidc = composeSidc('friend', 'infantry', 'division');
    const anchor = new ms.Symbol(sidc, { size: 30, strokeWidth: 6 }).getAnchor();
    const { w, h, tx, ty } = outer(symbolSvg(sidc));
    expect(anchor.x + tx).toBeCloseTo(w / 2);
    expect(anchor.y + ty).toBeCloseTo(h / 2);
  });

  it('draws a unit with an unspecified echelon at its own size, filled and stroked as before', () => {
    const sidc = composeSidc('friend', 'infantry');
    const svg = symbolSvg(sidc);
    const size = new ms.Symbol(sidc, { size: 30, strokeWidth: 6 }).getSize();
    const { w, h } = outer(svg);
    expect(w).toBeCloseTo(size.width);
    expect(h).toBeCloseTo(size.height);
    expect(svg).toContain(`fill="${colors.friendly}"`);
    expect(svg).toContain('stroke-width="6"');
  });
});
