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
export const ATTRIBUTION_RAISE = { portrait: 20, landscape: 24 } as const;

function attributionRaise(landscape: boolean): number {
  return landscape ? ATTRIBUTION_RAISE.landscape : ATTRIBUTION_RAISE.portrait;
}

/**
 * Logo row top in landscape (from the safe area). The (i) button's frame then starts slightly
 * above the safe area; that is padding around the icon, which stays on screen.
 */
export const LANDSCAPE_LOGO_TOP = 22;
/** Room reserved for the attribution (i) button, which sits left of the Mapbox wordmark. */
export const ATTRIBUTION_WIDTH = 32;

export type Insets = { top: number; right: number; bottom: number; left: number };

export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

/**
 * Top of the Mapbox logo row, measured from the safe area: under the full-width toolbar in
 * portrait, near the top edge in landscape.
 */
export function ornamentRowTop(landscape: boolean): number {
  return landscape ? LANDSCAPE_LOGO_TOP : EDGE + TOOLBAR_HEIGHT + GAP;
}

/**
 * Mapbox ornament positions. The logo and attribution must stay visible (Mapbox terms), so they
 * sit top-left (the (i) button first, then the wordmark): under the full-width toolbar in
 * portrait, beside the top-right toolbar in landscape. There is no scale bar (it costs too much screen space).
 *
 * `insets` are added to the margins. Mapbox on iOS already measures ornament margins from the
 * safe area, so pass zero insets there.
 */
export function ornamentPositions({ landscape, insets }: { landscape: boolean; insets: Insets }) {
  const left = insets.left + EDGE;
  const top = insets.top + ornamentRowTop(landscape);
  return {
    attribution: { top: top - attributionRaise(landscape), left },
    logo: { top, left: left + ATTRIBUTION_WIDTH },
  };
}
