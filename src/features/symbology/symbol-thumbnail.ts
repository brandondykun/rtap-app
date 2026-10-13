import { SYMBOL_IMAGES, SYMBOL_THUMBNAILS } from './symbol-images.generated';

/** The image for a symbol in a menu or list: the cropped thumbnail when there is one. */
export function symbolThumbnail(sidc: string): number | undefined {
  return SYMBOL_THUMBNAILS[sidc] ?? SYMBOL_IMAGES[sidc];
}
