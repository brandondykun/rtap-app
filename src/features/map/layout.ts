/** Spacing and sizes for map chrome (toolbar, controls, readout, Mapbox ornaments), in points. */
export const EDGE = 12;
export const GAP = 8;
export const TOOLBAR_HEIGHT = 64;
export const CONTROL_SIZE = 52;
/** Height of the Mapbox logo/attribution row. */
export const LOGO_ROW_HEIGHT = 28;
/**
 * The attribution (i) button's tappable frame is taller than the wordmark and centers its icon,
 * so at the same `top` the icon sits visibly lower. Raise it so the icon lines up with the logo.
 */
export const ATTRIBUTION_RAISE = 10;
/** Room reserved for the Mapbox wordmark before the attribution button. */
export const LOGO_WIDTH = 96;

export type Insets = { top: number; right: number; bottom: number; left: number };

export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

export function ornamentTop({ landscape, insets }: { landscape: boolean; insets: Insets }): number {
  return insets.top + EDGE + (landscape ? 0 : TOOLBAR_HEIGHT + GAP);
}

/**
 * Mapbox ornament positions. The logo and attribution must stay visible (Mapbox terms), so they
 * sit top-left: under the full-width toolbar in portrait, beside the top-right toolbar in
 * landscape. There is no scale bar (it costs too much screen space).
 */
export function ornamentPositions({ landscape, insets }: { landscape: boolean; insets: Insets }) {
  const left = insets.left + EDGE;
  const top = ornamentTop({ landscape, insets });
  return {
    logo: { top, left },
    attribution: { top: Math.max(0, top - ATTRIBUTION_RAISE), left: left + LOGO_WIDTH },
  };
}
