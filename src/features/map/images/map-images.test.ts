import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { KNOWN_SIDCS } from '@/features/symbology/categories';

import { LABEL_CHIP_IMAGE_OPTIONS, LABEL_CHIP_SPEC } from './map-image-specs';
import { MAP_IMAGE_IDS, MAP_IMAGES } from './map-images';

const ASSETS = join(__dirname, '../../../../assets/map');

describe('map images', () => {
  it('registers every unit and point symbol and the map images', () => {
    expect(Object.keys(MAP_IMAGES).sort()).toEqual([...KNOWN_SIDCS, ...Object.values(MAP_IMAGE_IDS)].sort());
  });

  it('has the generated files on disk', () => {
    for (const name of ['self', 'self-no-heading']) {
      for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `${name}${suffix}.png`))).toBe(true);
    }
    expect(existsSync(join(ASSETS, 'label-chip.png'))).toBe(true);
    for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `draft-ring${suffix}.png`))).toBe(true);
    expect(existsSync(join(ASSETS, 'label-chip-accent.png'))).toBe(true);
    for (const name of ['line-arrow', 'line-flot-arc', 'line-vertex']) {
      for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `${name}${suffix}.png`))).toBe(true);
    }
  });

  it('keeps the chip stretch zone inside the image and clear of the rounded corners', () => {
    // Options are in points; rnmapbox multiplies them by `scale` to get image pixels.
    const { scale } = LABEL_CHIP_IMAGE_OPTIONS;
    const [[x0, x1]] = LABEL_CHIP_IMAGE_OPTIONS.stretchX.map(([a, b]) => [a * scale, b * scale]);
    expect(x0).toBeGreaterThanOrEqual(LABEL_CHIP_SPEC.radiusPx);
    expect(x1).toBeLessThanOrEqual(LABEL_CHIP_SPEC.sizePx - LABEL_CHIP_SPEC.radiusPx);
    const [c0, c1, c2, c3] = LABEL_CHIP_IMAGE_OPTIONS.content.map((v) => v * scale);
    expect(Math.min(c0, c1)).toBeGreaterThanOrEqual(0);
    expect(Math.max(c2, c3)).toBeLessThanOrEqual(LABEL_CHIP_SPEC.sizePx);
    expect(LABEL_CHIP_IMAGE_OPTIONS.stretchY).toEqual(LABEL_CHIP_IMAGE_OPTIONS.stretchX);
  });
});
