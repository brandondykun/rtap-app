import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LABEL_CHIP_CONTENT_INSET_PT, LABEL_CHIP_IMAGE_OPTIONS, LABEL_CHIP_SPEC } from './map-image-specs';
import { MAP_IMAGE_IDS, MAP_IMAGES } from './map-images';

const ASSETS = join(__dirname, '../../../../assets/map');

describe('map images', () => {
  it('registers the fixed map images (symbols are registered at runtime)', () => {
    expect(Object.keys(MAP_IMAGES).sort()).toEqual(Object.values(MAP_IMAGE_IDS).sort());
  });

  it('has the generated files on disk', () => {
    for (const name of ['self', 'self-no-heading', 'self-manual', 'self-averaged', 'self-averaged-no-heading']) {
      for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `${name}${suffix}.png`))).toBe(true);
    }
    for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `draft-ring${suffix}.png`))).toBe(true);
    for (const name of ['line-arrow', 'line-flot-arc', 'line-vertex', 'temp-reticle']) {
      for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `${name}${suffix}.png`))).toBe(true);
    }
  });

  it('ships each chip as one @3x file, so iOS takes its density from the file name', () => {
    // Release builds load bundled images with UIImage imageNamed, which ignores a requested scale.
    for (const name of ['label-chip', 'label-chip-accent', 'label-chip-square']) {
      expect(existsSync(join(ASSETS, `${name}@${LABEL_CHIP_SPEC.scale}x.png`))).toBe(true);
      expect(existsSync(join(ASSETS, `${name}.png`))).toBe(false);
    }
  });

  it('registers the chips without a scale option, so dev and release builds size them the same', () => {
    for (const id of [MAP_IMAGE_IDS.labelChip, MAP_IMAGE_IDS.labelChipAccent, MAP_IMAGE_IDS.labelChipSquare]) {
      expect((MAP_IMAGES[id] as { scale?: number }).scale).toBeUndefined();
    }
  });

  it('keeps the chip stretch zone inside the image and clear of the rounded corners', () => {
    // Without a scale option, rnmapbox hands these to Mapbox as they are: image pixels.
    const [[x0, x1]] = LABEL_CHIP_IMAGE_OPTIONS.stretchX;
    expect(x0).toBeGreaterThanOrEqual(LABEL_CHIP_SPEC.radiusPx);
    expect(x1).toBeLessThanOrEqual(LABEL_CHIP_SPEC.sizePx - LABEL_CHIP_SPEC.radiusPx);
    const [c0, c1, c2, c3] = LABEL_CHIP_IMAGE_OPTIONS.content;
    expect(Math.min(c0, c1)).toBeGreaterThanOrEqual(0);
    expect(Math.max(c2, c3)).toBeLessThanOrEqual(LABEL_CHIP_SPEC.sizePx);
    expect(LABEL_CHIP_IMAGE_OPTIONS.stretchY).toEqual(LABEL_CHIP_IMAGE_OPTIONS.stretchX);
    expect(c0 / LABEL_CHIP_SPEC.scale).toBe(LABEL_CHIP_CONTENT_INSET_PT);
  });

  it('draws the square chip as one piece: no stretch zones, so a rotated chip cannot come apart', () => {
    const entry = MAP_IMAGES[MAP_IMAGE_IDS.labelChipSquare] as { stretchX?: unknown; stretchY?: unknown; content?: unknown };
    expect(entry.stretchX).toBeUndefined();
    expect(entry.stretchY).toBeUndefined();
    expect(entry.content).toBeUndefined();
  });
});
