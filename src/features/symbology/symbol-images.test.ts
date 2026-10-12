import { PRESET_SIDCS } from './presets';
import { SYMBOL_IMAGES } from './symbol-images.generated';

describe('generated symbol images', () => {
  it('has an image for every preset SIDC', () => {
    expect(Object.keys(SYMBOL_IMAGES).sort()).toEqual([...PRESET_SIDCS].sort());
  });
});
