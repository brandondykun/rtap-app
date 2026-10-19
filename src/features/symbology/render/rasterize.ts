import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { visibleBounds } from './visible-bounds';

/** SVG → PNG bytes at `scale`, optionally cropped to its visible pixels. Null when Skia cannot parse or draw it. */
export function rasterizeSvg(svgText: string, scale: number, trim: boolean): Uint8Array | null {
  const svg = Skia.SVG.MakeFromString(svgText, Skia.FontMgr.System());
  if (!svg) return null;
  const width = Math.ceil(svg.width() * scale);
  const height = Math.ceil(svg.height() * scale);
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  canvas.drawSvg(svg);
  surface.flush();
  let image = surface.makeImageSnapshot();
  if (trim) {
    const pixels = image.readPixels();
    const box = pixels instanceof Uint8Array ? visibleBounds(pixels, width, height) : null;
    if (box) image = surface.makeImageSnapshot(Skia.XYWHRect(box.x, box.y, box.width, box.height));
  }
  return image.encodeToBytes(ImageFormat.PNG, 100);
}
