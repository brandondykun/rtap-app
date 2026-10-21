import { OP_ICON_GAIN, OP_ICON_REF_ZOOM, opIconSize } from './op-icon-size';

/** Evaluates the size expression at a zoom, as Mapbox does (exponential interpolation between its two stops). */
function sizeAt(expression: unknown, zoom: number): number {
  const [, [, base], , z0, [, f0, s0], z1, [, f1, s1]] = expression as [string, [string, number], unknown, number, [string, number, number], number, [string, number, number]];
  const v0 = f0 * s0;
  const v1 = f1 * s1;
  const t = (base ** (zoom - z0) - 1) / (base ** (z1 - z0) - 1);
  return v0 + t * (v1 - v0);
}

describe('opIconSize', () => {
  it('was tuned on a device to a quarter gain about zoom 16', () => {
    expect(OP_ICON_GAIN).toBe(0.25);
    expect(OP_ICON_REF_ZOOM).toBe(16);
  });

  it('keeps the normal size at the reference zoom and scales by 2^(gain × zoom change) either side', () => {
    const size = opIconSize(0.8);
    expect(sizeAt(size, 16)).toBeCloseTo(0.8);
    expect(sizeAt(size, 20)).toBeCloseTo(0.8 * 2);
    expect(sizeAt(size, 12)).toBeCloseTo(0.8 / 2);
    expect(sizeAt(size, 17.5)).toBeCloseTo(0.8 * 2 ** (0.25 * 1.5));
  });

  it('wraps a per-feature size expression and defaults to 1', () => {
    const match = ['match', ['get', 'category'], 'point', 0.76, 0.8];
    expect(JSON.stringify(opIconSize(match as never))).toContain(JSON.stringify(match));
    expect(sizeAt(opIconSize(undefined), 16)).toBeCloseTo(1);
  });
});
