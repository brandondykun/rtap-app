import type { SymbolLayerStyle } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { useOp } from '@/stores/op';

/**
 * In OP mode Mapbox scales screen-facing icons by their distance relative to the screen center's. Near the ground that
 * center swings from close by (looking down) to the horizon (looking up), so the icons shrink and grow as the view tilts.
 * The camera zoom swings with it, so the icon size follows the zoom to cancel most of it. Tuned on a device: a full
 * gain (1) and half (0.5) overcorrected looking down; a quarter held the icons steady.
 */
export const OP_ICON_GAIN = 0.25;
/** The zoom at which icons keep their normal size (about the zoom of the usual OP view). */
export const OP_ICON_REF_ZOOM = 16;

/**
 * `size` (a number or per-feature expression; 1 when unset) times 2^(OP_ICON_GAIN × (zoom − OP_ICON_REF_ZOOM)). Exact
 * at every zoom: exponential interpolation with base 2^gain between two stops on that curve stays on it.
 */
export function opIconSize(size: SymbolLayerStyle['iconSize'] | undefined): SymbolLayerStyle['iconSize'] {
  const at = (zoom: number) => ['*', 2 ** (OP_ICON_GAIN * (zoom - OP_ICON_REF_ZOOM)), size ?? 1];
  return ['interpolate', ['exponential', 2 ** OP_ICON_GAIN], ['zoom'], 0, at(0), 24, at(24)] as unknown as SymbolLayerStyle['iconSize'];
}

/** `style` as is, or in OP mode with its icon size following the zoom (opIconSize). Pass a stable style. */
export function useOpIconStyle(style: SymbolLayerStyle): SymbolLayerStyle {
  const inOp = useOp((s) => s.phase === 'on');
  return useMemo(() => (inOp ? { ...style, iconSize: opIconSize(style.iconSize) } : style), [inOp, style]);
}
