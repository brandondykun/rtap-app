import { act, renderHook } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_OP, useOp } from '@/stores/op';

import { OP_LABEL_ZOOM_STEP, OP_SCALE_GAIN, OP_SCALE_REF_ZOOM, opSize, opSymbolStyle, opTextSize, useOpSymbolStyle } from './op-symbol-scale';

/** Evaluates the size expression at a zoom, as Mapbox does (exponential interpolation between its two stops). */
function sizeAt(expression: unknown, zoom: number): number {
  const [, [, base], , z0, [, f0, s0], z1, [, f1, s1]] = expression as [string, [string, number], unknown, number, [string, number, number], number, [string, number, number]];
  const v0 = f0 * s0;
  const v1 = f1 * s1;
  const t = (base ** (zoom - z0) - 1) / (base ** (z1 - z0) - 1);
  return v0 + t * (v1 - v0);
}

describe('opSize', () => {
  it('was tuned on a device to a quarter gain about zoom 16', () => {
    expect(OP_SCALE_GAIN).toBe(0.25);
    expect(OP_SCALE_REF_ZOOM).toBe(16);
  });

  it('keeps the normal size at the reference zoom and scales by 2^(gain × zoom change) either side', () => {
    const size = opSize(0.8);
    expect(sizeAt(size, 16)).toBeCloseTo(0.8);
    expect(sizeAt(size, 20)).toBeCloseTo(0.8 * 2);
    expect(sizeAt(size, 12)).toBeCloseTo(0.8 / 2);
    expect(sizeAt(size, 17.5)).toBeCloseTo(0.8 * 2 ** (0.25 * 1.5));
  });

  it('wraps a per-feature size expression and defaults to 1', () => {
    const match = ['match', ['get', 'category'], 'point', 0.76, 0.8];
    expect(JSON.stringify(opSize(match as never))).toContain(JSON.stringify(match));
    expect(sizeAt(opSize(undefined), 16)).toBeCloseTo(1);
  });

  it('scales a label by its text at a fixed size for the camera zoom (its chip fits it) and an icon by its icon size', () => {
    const label = { textField: ['get', 'name'], textSize: 12, iconImage: 'chip', iconTextFit: 'both' } as const;
    expect(opSymbolStyle(label, 18)).toEqual({ ...label, textSize: 12 * 2 ** 0.5 });
    expect(opSymbolStyle({ textField: 'x' }, 16)).toEqual({ textField: 'x', textSize: 16 });
    const icon = { iconImage: 'dot', iconSize: 0.7 };
    expect(opSymbolStyle(icon, 18)).toEqual({ ...icon, iconSize: opSize(0.7) });
  });
});

describe('opTextSize', () => {
  it('follows the zoom in steps of a tenth, each under 2% of size', () => {
    expect(OP_LABEL_ZOOM_STEP).toBe(0.1);
    expect(opTextSize(12, 20)).toBeCloseTo(24);
    expect(opTextSize(12, 18.04)).toBeCloseTo(opTextSize(12, 18) as number);
    expect(opTextSize(12, 18.06)).toBeCloseTo(12 * 2 ** (0.25 * 2.1));
    expect(2 ** (OP_SCALE_GAIN * OP_LABEL_ZOOM_STEP)).toBeLessThan(1.02);
  });

  it('wraps a per-feature size expression', () => {
    const match = ['match', ['get', 'size'], 'large', 15, 12];
    expect(opTextSize(match as never, 20)).toEqual(['*', 2, match]);
  });
});

describe('useOpSymbolStyle', () => {
  beforeEach(() => {
    useInteraction.setState(INITIAL_INTERACTION);
    useOp.setState(INITIAL_OP);
  });

  it('in OP mode resizes a label as the camera zoom crosses a step, and leaves it be outside OP mode', async () => {
    const label = { textField: 'x', textSize: 12 };
    useInteraction.setState({ cameraZoom: 16 });
    const { result } = await renderHook(() => useOpSymbolStyle(label));
    expect(result.current).toBe(label);
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } }));
    expect(result.current.textSize).toBeCloseTo(12);
    await act(async () => useInteraction.setState({ cameraZoom: 20 }));
    expect(result.current.textSize).toBeCloseTo(24);
    await act(async () => useOp.getState().exit());
    expect(result.current).toBe(label);
  });
});
