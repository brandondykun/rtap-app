import { visibleBounds } from './visible-bounds';

function image(width: number, height: number, opaque: [number, number][]) {
  const px = new Uint8Array(width * height * 4);
  for (const [x, y] of opaque) px[(y * width + x) * 4 + 3] = 255;
  return px;
}

describe('visibleBounds', () => {
  it('is the box around the non-transparent pixels', () => {
    expect(visibleBounds(image(10, 8, [[2, 3], [6, 5]]), 10, 8)).toEqual({ x: 2, y: 3, width: 5, height: 3 });
  });
  it('is null for a fully transparent image', () => {
    expect(visibleBounds(image(4, 4, []), 4, 4)).toBeNull();
  });
});
