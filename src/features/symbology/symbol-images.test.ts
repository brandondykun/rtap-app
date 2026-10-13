import { KNOWN_SIDCS } from './categories';
import { SYMBOL_IMAGES } from './symbol-images.generated';

describe('generated symbol images', () => {
  it('has an image for every unit preset and point type', () => {
    expect(Object.keys(SYMBOL_IMAGES).sort()).toEqual([...KNOWN_SIDCS].sort());
  });
});
