import type { SymbolLayerStyle } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { useInteraction } from '@/stores/interaction';
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
/** Labels follow the camera zoom in steps this fine: each is under 2% of size, too small to see. */
export const OP_LABEL_ZOOM_STEP = 0.1;

/** 2^(OP_SCALE_GAIN × (zoom − OP_SCALE_REF_ZOOM)): the size factor at a zoom. */
const opScale = (zoom: number) => 2 ** (OP_SCALE_GAIN * (zoom - OP_SCALE_REF_ZOOM));

/**
 * `size` (a number or per-feature expression; 1 when unset) times opScale(zoom), following the map's zoom. Exact
 * at every zoom: exponential interpolation with base 2^gain between two stops on that curve stays on it.
 */
export function opSize(size: SymbolLayerStyle['iconSize'] | undefined): SymbolLayerStyle['iconSize'] {
  const at = (zoom: number) => ['*', opScale(zoom), size ?? 1];
  return ['interpolate', ['exponential', 2 ** OP_SCALE_GAIN], ['zoom'], 0, at(0), 24, at(24)] as unknown as SymbolLayerStyle['iconSize'];
}

/** The camera zoom rounded to OP_LABEL_ZOOM_STEP. */
export const opLabelZoom = (zoom: number) => Math.round(zoom / OP_LABEL_ZOOM_STEP) * OP_LABEL_ZOOM_STEP;

/**
 * A text size (a number or per-feature expression) times opScale at the camera zoom (rounded to OP_LABEL_ZOOM_STEP), as a
 * fixed size. Not a zoom expression like opSize: Mapbox fits a label's chip around its text at the size it lays the label out
 * at, then keeps the chip while a zoom-driven text size moves on, so the text would slide off center in its chip.
 */
export function opTextSize(size: SymbolLayerStyle['textSize'], zoom: number): SymbolLayerStyle['textSize'] {
  const scale = opScale(opLabelZoom(zoom));
  return (typeof size === 'number' ? size * scale : ['*', scale, size]) as SymbolLayerStyle['textSize'];
}

/** Mapbox's text size when a style sets none. */
const DEFAULT_TEXT_SIZE = 16;

const isLabel = (style: SymbolLayerStyle) => style.textField !== undefined;

/**
 * `style` with its size following the zoom: a label by its text at the camera `zoom` (opTextSize; its fitted chip follows
 * the text), an icon by its icon size (opSize).
 */
export function opSymbolStyle(style: SymbolLayerStyle, zoom: number): SymbolLayerStyle {
  if (isLabel(style)) return { ...style, textSize: opTextSize(style.textSize ?? DEFAULT_TEXT_SIZE, zoom) };
  return { ...style, iconSize: opSize(style.iconSize) };
}

/** `style` as is, or in OP mode with its size following the zoom (opSymbolStyle). Pass a stable style. */
export function useOpSymbolStyle(style: SymbolLayerStyle): SymbolLayerStyle {
  const inOp = useOp((s) => s.phase === 'on');
  // Only labels in OP mode follow the camera zoom, and only re-render when it crosses a step.
  const zoom = useInteraction((s) => (inOp && isLabel(style) ? opLabelZoom(s.cameraZoom) : 0));
  return useMemo(() => (inOp ? opSymbolStyle(style, zoom) : style), [inOp, style, zoom]);
}
