import { Directory, File } from 'expo-file-system';

import { createSymbolCache, SYMBOL_RENDER_VERSION } from './symbol-cache';

const fs = jest.requireMock('expo-file-system') as { __files: Set<string> };
const root = new Directory('file:///cache', 'symbols');

function setup(rasterize = jest.fn((_svg: string, _scale: number, _trim: boolean): Uint8Array | null => new Uint8Array([1]))) {
  const svgFor = jest.fn((sidc: string) => `<svg>${sidc}</svg>`);
  const log = jest.fn();
  return { cache: createSymbolCache({ root, scale: 3, svgFor, rasterize, log }), rasterize, svgFor, log };
}

beforeEach(() => fs.__files.clear());

describe('symbol cache', () => {
  it('renders a missing symbol once, writes it under the version folder, and returns its uri and scale', async () => {
    const { cache, rasterize } = setup();
    const img = await cache.get('SFGPUCI----E---');
    expect(img).toEqual({ uri: `file:///cache/symbols/v${SYMBOL_RENDER_VERSION}/SFGPUCI----E---@3.png`, scale: 3 });
    expect(fs.__files.has(img!.uri)).toBe(true);
    expect(rasterize).toHaveBeenCalledWith('<svg>SFGPUCI----E---</svg>', 3, false);
  });

  it('reads an existing file without rendering again (also across cache instances)', async () => {
    await setup().cache.get('SHGPU----------');
    const second = setup();
    await second.cache.get('SHGPU----------');
    expect(second.rasterize).not.toHaveBeenCalled();
  });

  it('shares one render between concurrent requests', async () => {
    const { cache, rasterize } = setup();
    const [a, b] = await Promise.all([cache.get('SNGPU----------'), cache.get('SNGPU----------')]);
    expect(a).toEqual(b);
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  it('keeps trimmed point thumbnails separate, and trims only points', async () => {
    const { cache, rasterize } = setup();
    expect((await cache.get('GFGPGPPK------X', { trimmed: true }))!.uri).toMatch(/GFGPGPPK------X@3-trim\.png$/);
    expect(rasterize).toHaveBeenLastCalledWith(expect.any(String), 3, true);
    // Units are not padded, so their thumbnail is the map image.
    expect((await cache.get('SFGPU----------', { trimmed: true }))!.uri).toMatch(/SFGPU----------@3\.png$/);
  });

  it('deletes other version folders on first use', async () => {
    fs.__files.add('file:///cache/symbols/v0/OLD@3.png');
    await setup().cache.get('SUGPU----------');
    expect(fs.__files.has('file:///cache/symbols/v0/OLD@3.png')).toBe(false);
  });

  it('resolves null and logs once when a symbol cannot be drawn, without retrying in a loop', async () => {
    const { cache, rasterize, log } = setup(jest.fn((_svg: string, _scale: number, _trim: boolean): Uint8Array | null => null));
    expect(await cache.get('BAD')).toBeNull();
    expect(await cache.get('BAD')).toBeNull();
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('resolves null when drawing throws', async () => {
    const { cache } = setup(jest.fn((_svg: string, _scale: number, _trim: boolean): Uint8Array | null => {
      throw new Error('skia');
    }));
    await expect(cache.get('SFGPU----------')).resolves.toBeNull();
    expect(new File(root, `v${SYMBOL_RENDER_VERSION}`, 'SFGPU----------@3.png').exists).toBe(false);
  });
});
