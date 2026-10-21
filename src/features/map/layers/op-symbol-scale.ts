import type { SymbolLayerStyle } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { useOp } from '@/stores/op';

/**
 * In OP mode Mapbox scales screen-facing icons and labels by their distance relative to the screen center's. Near the ground that
 * center swings from close by (looking down) to the horizon (looking up), so they shrink and grow as the view tilts.
 * The camera zoom swings with it, so their size follows the zoom to cancel most of it. Tuned on a device: a full
 * gain (1) and half (0.5) overcorrected looking down; a quarter held the icons steady.
 */
export const OP_SCALE_GAIN = 0.25;
/** The zoom at which icons and labels keep their normal size (about the zoom of the usual OP view). */
export const OP_SCALE_REF_ZOOM = 16;

/**
 * `size` (a number or per-feature expression; 1 when unset) times 2^(OP_SCALE_GAIN × (zoom − OP_SCALE_REF_ZOOM)). Exact
 * at every zoom: exponential interpolation with base 2^gain between two stops on that curve stays on it.
 */
export function opSize(size: SymbolLayerStyle['iconSize'] | undefined): SymbolLayerStyle['iconSize'] {
  const at = (zoom: number) => ['*', 2 ** (OP_SCALE_GAIN * (zoom - OP_SCALE_REF_ZOOM)), size ?? 1];
  return ['interpolate', ['exponential', 2 ** OP_SCALE_GAIN], ['zoom'], 0, at(0), 24, at(24)] as unknown as SymbolLayerStyle['iconSize'];
}

/** Mapbox's text size when a style sets none. */
const DEFAULT_TEXT_SIZE = 16;

/** `style` with its size following the zoom (opSize): a label by its text (a fitted chip follows the text), an icon by its icon size. */
export function opSymbolStyle(style: SymbolLayerStyle): SymbolLayerStyle {
  if (style.textField !== undefined) return { ...style, textSize: opSize(style.textSize ?? DEFAULT_TEXT_SIZE) as SymbolLayerStyle['textSize'] };
  return { ...style, iconSize: opSize(style.iconSize) };
}

/** `style` as is, or in OP mode with its size following the zoom (opSymbolStyle). Pass a stable style. */
export function useOpSymbolStyle(style: SymbolLayerStyle): SymbolLayerStyle {
  const inOp = useOp((s) => s.phase === 'on');
  return useMemo(() => (inOp ? opSymbolStyle(style) : style), [inOp, style]);
}
