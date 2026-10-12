/** Spacing and sizes for map chrome (toolbar, controls, readout, Mapbox ornaments), in points. */
export const EDGE = 12;
export const GAP = 8;
export const TOOLBAR_HEIGHT = 64;
export const CONTROL_SIZE = 52;
export const READOUT_HEIGHT = 72;
/** Room reserved for the Mapbox wordmark before the attribution button. */
export const LOGO_WIDTH = 96;

export type Insets = { top: number; right: number; bottom: number; left: number };

export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

/**
 * Mapbox ornament positions. The logo and attribution must stay visible (Mapbox terms), so they
 * sit top-left: under the full-width toolbar in portrait, beside the top-right toolbar in
 * landscape. The scale bar sits just above the readout card.
 */
export function ornamentPositions({ landscape, insets }: { landscape: boolean; insets: Insets }) {
  const left = insets.left + EDGE;
  const top = insets.top + EDGE + (landscape ? 0 : TOOLBAR_HEIGHT + GAP);
  return {
    logo: { top, left },
    attribution: { top, left: left + LOGO_WIDTH },
    scaleBar: { bottom: insets.bottom + EDGE + READOUT_HEIGHT + GAP, left },
  };
}
