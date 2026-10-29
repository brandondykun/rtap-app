import type { PanelFrame } from '@/components/menu/panel-geometry';

/** Spacing and sizes for map chrome (toolbar, controls, readout, Mapbox ornaments), in points. */
export const EDGE = 4;
export const GAP = 8;
export const TOOLBAR_HEIGHT = 46;
/** The toolbar with its text hidden (icons only). */
export const TOOLBAR_HEIGHT_ICONS = 42;
/** Space above and below each tool in the toolbar: its highlight's corner (12, rounded-xl) is the bar's (16, rounded-2xl) less this. */
export const TOOL_INSET = 4;
export const CONTROL_SIZE = 40;
/** Height of the Mapbox logo/attribution row. */
export const LOGO_ROW_HEIGHT = 28;
/**
 * The attribution (i) button's tappable frame is taller than the wordmark and centers its icon,
 * so at the same `top` the icon sits visibly lower. Raise it so the icon lines up with the logo.
 */
export const ATTRIBUTION_RAISE = { portrait: 22, landscape: 22 } as const;

function attributionRaise(landscape: boolean): number {
  return landscape ? ATTRIBUTION_RAISE.landscape : ATTRIBUTION_RAISE.portrait;
}

/**
 * Logo row top in landscape (from the safe area). The (i) button's frame then starts slightly
 * above the safe area; that is padding around the icon, which stays on screen.
 */
export const LANDSCAPE_LOGO_TOP = 14;
/** Room reserved for the attribution (i) button, which sits left of the Mapbox wordmark. */
export const ATTRIBUTION_WIDTH = 36;

export type Insets = { top: number; right: number; bottom: number; left: number };

export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

/**
 * Top of the Mapbox logo row, measured from the safe area: under the full-width toolbar in
 * portrait, near the top edge in landscape.
 */
export function ornamentRowTop(landscape: boolean, toolbar: number = TOOLBAR_HEIGHT): number {
  return landscape ? LANDSCAPE_LOGO_TOP : EDGE + toolbar + GAP;
}

/** Toolbar height for the Show toolbar text setting. */
export function toolbarHeight(showText: boolean): number {
  return showText ? TOOLBAR_HEIGHT : TOOLBAR_HEIGHT_ICONS;
}

/** Height of the Mapbox wordmark itself (the logo row reserves more). */
export const LOGO_WORDMARK_HEIGHT = 22;

/** Top of the top-left stack (GPS readout, location notice), from the safe area: right under the wordmark. */
export function topLeftStackTop(landscape: boolean, toolbar: number = TOOLBAR_HEIGHT): number {
  return ornamentRowTop(landscape, toolbar) + LOGO_WORDMARK_HEIGHT;
}

/**
 * Location banner top (from the safe area): below the Mapbox logo row and below the toolbar,
 * whichever is lower. In landscape the toolbar is top-right, so the logo row alone is too high.
 */
export function bannerTop(landscape: boolean, toolbar: number = TOOLBAR_HEIGHT): number {
  return Math.max(ornamentRowTop(landscape, toolbar) + LOGO_ROW_HEIGHT, EDGE + toolbar + GAP);
}

/**
 * Mapbox ornament positions. The logo and attribution must stay visible (Mapbox terms), so they
 * sit top-left (the (i) button first, then the wordmark): under the full-width toolbar in
 * portrait, beside the top-right toolbar in landscape. There is no scale bar (it costs too much screen space).
 *
 * `insets` are added to the margins. Mapbox on iOS already measures ornament margins from the
 * safe area, so pass zero insets there.
 */
export function ornamentPositions({
  landscape,
  insets,
  leftOffset = 0,
  toolbarHeight: toolbar = TOOLBAR_HEIGHT,
}: {
  landscape: boolean;
  insets: Insets;
  leftOffset?: number;
  toolbarHeight?: number;
}) {
  const left = insets.left + EDGE + leftOffset;
  const top = insets.top + ornamentRowTop(landscape, toolbar);
  return {
    attribution: { top: top - attributionRaise(landscape), left },
    logo: { top, left: left + ATTRIBUTION_WIDTH },
  };
}

export type CameraPadding = { paddingTop: number; paddingRight: number; paddingBottom: number; paddingLeft: number };

/** Camera padding equal to the panel's area, so the camera center is the visible map's center. */
export function cameraPaddingFor(panel: PanelFrame | null): CameraPadding {
  return {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: panel?.side === 'bottom' ? panel.size : 0,
    paddingLeft: panel?.side === 'left' ? panel.size : 0,
  };
}

/**
 * Height left for bottom controls between north-up and a bottom sheet (a full detent can leave none).
 * Infinity without a bottom sheet.
 */
export function roomAboveSheet(windowHeight: number, panel: PanelFrame | null, insetTop: number, toolbar: number): number {
  if (panel?.side !== 'bottom') return Infinity;
  return windowHeight - panel.size - (insetTop + EDGE + toolbar + GAP + CONTROL_SIZE + GAP + EDGE);
}

/**
 * How something along the bottom keeps clear of your card (bottom right, under the zoom buttons):
 * `beside` keeps it left of the card, otherwise it is raised above the card and only clears the
 * zoom column. `right` excludes the safe area and the edge margin.
 */
export function selfCardClearance(card: { width: number; height: number }, beside: boolean): { lift: number; right: number } {
  if (card.height === 0) return { lift: 0, right: CONTROL_SIZE + GAP };
  return beside ? { lift: 0, right: Math.max(CONTROL_SIZE, card.width) + GAP } : { lift: card.height + GAP, right: CONTROL_SIZE + GAP };
}

/**
 * In landscape with a drawer open (drawing a line or polygon) there is no room for both an action bar and
 * the dock's CTR row: the row hides while the bar is up.
 */
export function barTakesReadoutSpot(landscape: boolean, panel: PanelFrame | null, hasBar: boolean): boolean {
  return landscape && panel !== null && hasBar;
}
