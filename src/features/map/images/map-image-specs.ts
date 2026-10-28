/** Geometry shared by scripts/build-map-images.ts and the runtime image registry. */

/** Self icon canvas at @1x, in px (generated at @1x/@2x/@3x). The icon points north; the layer rotates it. */
export const SELF_ICON_SIZE = 64;

/** Draft selection ring canvas at @1x, in px (generated at @1x/@2x/@3x). */
export const DRAFT_RING_SIZE = 72;
export const DRAFT_RING_RADIUS = 24;

/**
 * Label chip: one image drawn at 3× pixel density and shipped as a single `@3x` file, so iOS gives it scale 3 whether it
 * comes from Metro (dev builds) or from the app bundle (release builds). Not a `scale` option: release builds load bundled
 * images with UIImage imageNamed, which takes the scale from the file name and ignores the one asked for, so the chip came
 * out 3× too big there. Without `scale`, rnmapbox hands the options below to Mapbox as they are, so they are in image pixels.
 */
export const LABEL_CHIP_SPEC = { sizePx: 72, radiusPx: 9, insetPx: 9, scale: 3 } as const;

const { sizePx, insetPx, scale } = LABEL_CHIP_SPEC;
const inner: [number, number] = [insetPx, sizePx - insetPx];

export const LABEL_CHIP_IMAGE_OPTIONS: {
  stretchX: [number, number][];
  stretchY: [number, number][];
  content: [number, number, number, number];
} = {
  stretchX: [inner],
  stretchY: [inner],
  content: [insetPx, insetPx, sizePx - insetPx, sizePx - insetPx],
};

/** The chip's content inset on screen, in points: the room it keeps around the text before any fit padding. */
export const LABEL_CHIP_CONTENT_INSET_PT = insetPx / scale;
