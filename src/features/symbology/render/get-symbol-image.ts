import { Directory, Paths } from 'expo-file-system';
import { PixelRatio } from 'react-native';

import { rasterizeSvg } from './rasterize';
import { createSymbolCache, type SymbolImage } from './symbol-cache';
import { symbolSvg } from './symbol-svg';

let cache: ReturnType<typeof createSymbolCache> | null = null;

/** The one entry point for symbol images (map and menus): a cached PNG for this device's pixel density. */
export function getSymbolImage(sidc: string, opts?: { trimmed?: boolean }): Promise<SymbolImage | null> {
  cache ??= createSymbolCache({
    root: new Directory(Paths.cache, 'symbols'),
    scale: Math.min(3, Math.max(1, Math.round(PixelRatio.get()))),
    svgFor: symbolSvg,
    rasterize: rasterizeSvg,
  });
  return cache.get(sidc, opts);
}

export type { SymbolImage };
