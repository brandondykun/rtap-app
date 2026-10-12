/** Geometry shared by scripts/build-map-images.ts and the runtime image registry. */

/** Self icon canvas at @1x, in px (generated at @1x/@2x/@3x). The icon points north; the layer rotates it. */
export const SELF_ICON_SIZE = 64;

/**
 * Label chip: one image rendered at 3× pixel density, shipped as a single file with `scale: 3`.
 * rnmapbox multiplies stretch/content values by `scale` before handing them to Mapbox, so the
 * options below are in points (image pixels ÷ scale).
 */
export const LABEL_CHIP_SPEC = { sizePx: 72, radiusPx: 12, insetPx: 18, scale: 3 } as const;

const { sizePx, insetPx, scale } = LABEL_CHIP_SPEC;
const inset = insetPx / scale;
const size = sizePx / scale;
const inner: [number, number] = [inset, size - inset];

export const LABEL_CHIP_IMAGE_OPTIONS: {
  scale: number;
  stretchX: [number, number][];
  stretchY: [number, number][];
  content: [number, number, number, number];
} = {
  scale,
  stretchX: [inner],
  stretchY: [inner],
  content: [inset, inset, size - inset, size - inset],
};
