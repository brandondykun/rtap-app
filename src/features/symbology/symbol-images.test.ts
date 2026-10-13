import { KNOWN_SIDCS } from './categories';
import { POINT_SIDCS } from './point-types';
import { SYMBOL_IMAGES, SYMBOL_THUMBNAILS } from './symbol-images.generated';
import { symbolThumbnail } from './symbol-thumbnail';

describe('generated symbol images', () => {
  it('has an image for every unit preset and point type', () => {
    expect(Object.keys(SYMBOL_IMAGES).sort()).toEqual([...KNOWN_SIDCS].sort());
  });
});

describe('symbol thumbnails', () => {
  it('has a tightly cropped thumbnail for every point type and falls back to the map image', () => {
    expect(Object.keys(SYMBOL_THUMBNAILS).sort()).toEqual([...POINT_SIDCS].sort());
    expect(symbolThumbnail('GFGPGPPK------X')).toBe(SYMBOL_THUMBNAILS['GFGPGPPK------X']);
    expect(symbolThumbnail('SHGPUCI--------')).toBe(SYMBOL_IMAGES['SHGPUCI--------']);
  });
});
