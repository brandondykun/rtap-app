import { Directory, File } from 'expo-file-system';

/** Bump whenever symbol drawing or colors change: older cached images are deleted on first use. */
export const SYMBOL_RENDER_VERSION = 3;

export type SymbolImage = { uri: string; scale: number };

type Deps = {
  root: Directory;
  scale: number;
  svgFor: (sidc: string) => string;
  rasterize: (svg: string, scale: number, trim: boolean) => Uint8Array | null;
  log?: (message: string) => void;
};

/** Symbol PNGs on disk by SIDC, rendered on first use. Never throws; a symbol that cannot be drawn is null (once). */
export function createSymbolCache({ root, scale, svgFor, rasterize, log = console.warn }: Deps) {
  const pending = new Map<string, Promise<SymbolImage | null>>();
  const versionDir = new Directory(root, `v${SYMBOL_RENDER_VERSION}`);
  let prepared = false;

  const prepare = () => {
    if (prepared) return;
    prepared = true;
    try {
      root.create({ intermediates: true, idempotent: true });
      for (const entry of root.list()) if (entry instanceof Directory && entry.name !== `v${SYMBOL_RENDER_VERSION}`) entry.delete();
      versionDir.create({ intermediates: true, idempotent: true });
    } catch (e) {
      log(`[symbols] cache folder: ${String(e)}`);
    }
  };

  const render = async (sidc: string, trim: boolean, key: string): Promise<SymbolImage | null> => {
    prepare();
    const file = new File(versionDir, `${key}.png`);
    if (file.exists) return { uri: file.uri, scale };
    try {
      const png = rasterize(svgFor(sidc), scale, trim);
      if (!png) {
        log(`[symbols] could not draw ${sidc}`);
        return null;
      }
      file.write(png);
      return { uri: file.uri, scale };
    } catch (e) {
      log(`[symbols] could not draw ${sidc}: ${String(e)}`);
      return null;
    }
  };

  return {
    get(sidc: string, opts: { trimmed?: boolean } = {}): Promise<SymbolImage | null> {
      // Map images are padded around their anchor; a thumbnail is cropped to what is drawn.
      const trim = !!opts.trimmed;
      const key = `${sidc}@${scale}${trim ? '-trim' : ''}`;
      let job = pending.get(key);
      if (!job) {
        job = render(sidc, trim, key);
        pending.set(key, job);
      }
      return job;
    },
  };
}
