import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PRESET_SIDCS } from '@/features/symbology/presets';

import { LABEL_CHIP_IMAGE_OPTIONS, LABEL_CHIP_SPEC } from './map-image-specs';
import { MAP_IMAGE_IDS, MAP_IMAGES } from './map-images';

const ASSETS = join(__dirname, '../../../../assets/map');

describe('map images', () => {
  it('registers every preset symbol and the map images', () => {
    expect(Object.keys(MAP_IMAGES).sort()).toEqual([...PRESET_SIDCS, ...Object.values(MAP_IMAGE_IDS)].sort());
  });

  it('has the generated files on disk', () => {
    for (const name of ['self', 'self-no-heading']) {
      for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `${name}${suffix}.png`))).toBe(true);
    }
    expect(existsSync(join(ASSETS, 'label-chip.png'))).toBe(true);
  });

  it('keeps the chip stretch zone clear of the rounded corners', () => {
    const [[x0, x1]] = LABEL_CHIP_IMAGE_OPTIONS.stretchX;
    expect(x0).toBeGreaterThanOrEqual(LABEL_CHIP_SPEC.radiusPx);
    expect(x1).toBeLessThanOrEqual(LABEL_CHIP_SPEC.sizePx - LABEL_CHIP_SPEC.radiusPx);
    expect(LABEL_CHIP_IMAGE_OPTIONS.stretchY).toEqual(LABEL_CHIP_IMAGE_OPTIONS.stretchX);
  });
});
