/** Geometry shared by scripts/build-map-images.ts and the runtime image registry. */

/** Self icon canvas at @1x, in px (generated at @1x/@2x/@3x). The icon points north; the layer rotates it. */
export const SELF_ICON_SIZE = 64;

/**
 * Label chip: one image rendered at 3× pixel density. Mapbox stretch/content values are in
 * image pixels, so the chip ships as a single 3× file with `scale: 3` to keep them unambiguous.
 */
export const LABEL_CHIP_SPEC = { sizePx: 72, radiusPx: 12, insetPx: 18, scale: 3 } as const;

const { sizePx, insetPx, scale } = LABEL_CHIP_SPEC;
const inner: [number, number] = [insetPx, sizePx - insetPx];

export const LABEL_CHIP_IMAGE_OPTIONS: {
  scale: number;
  stretchX: [number, number][];
  stretchY: [number, number][];
  content: [number, number, number, number];
} = {
  scale,
  stretchX: [inner],
  stretchY: [inner],
  content: [insetPx, insetPx, sizePx - insetPx, sizePx - insetPx],
};
