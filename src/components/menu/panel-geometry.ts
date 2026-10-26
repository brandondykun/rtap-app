/** The screen area a panel occupies: a bottom sheet's height or a left drawer's width, in points. */
export type PanelFrame = { side: 'bottom' | 'left'; size: number };

export type Detent = 'peek' | 'half' | 'full';

/** Every menu snaps to the same three heights in portrait and opens at half (shorter when its content is). */
export const MENU_DETENTS: readonly Detent[] = ['peek', 'half', 'full'];
export const MENU_INITIAL_DETENT: Detent = 'half';

export type PanelMetrics = {
  width: number;
  height: number;
  insets: { top: number; right: number; bottom: number; left: number };
  /** Space at the top a full-height sheet must leave free (safe area + toolbar). */
  topReserved: number;
};

/** The hide rail and the menu header row (the drag area), with a little content. */
export const PEEK_HEIGHT = 88;
export const MIN_HALF_HEIGHT = 300;
export const HALF_FRACTION = 0.42;
/** Narrow enough to leave map beside it, wide enough for a full MGRS row (see the geometry test). */
export const DRAWER_MIN_WIDTH = 326;
export const DRAWER_MAX_WIDTH = 400;
export const DRAWER_FRACTION = 0.38;
/** The rail that hides the open panel (the drawer's right edge, the sheet's top edge); the menu content gives up this much. */
export const RAIL_WIDTH = 16;
/** The sheet's own drag grip row under the rail, for content without a menu header (a header row is the drag area). */
export const SHEET_HANDLE_HEIGHT = 28;
/** The sheet's top border and hide rail. */
export const SHEET_EDGE_HEIGHT = 1 + RAIL_WIDTH;
/** Everything above headerless content: the edge and the grip row. */
export const SHEET_CHROME_HEIGHT = SHEET_EDGE_HEIGHT + SHEET_HANDLE_HEIGHT;
/** Portrait, minimized: the reopen bar along the bottom, and its margin from the screen edge (the map chrome's EDGE). */
export const MINIMIZED_BAR_HEIGHT = 44;
export const MINIMIZED_BAR_MARGIN = 4;
/** Its side margin, in line with the portrait grid dock (the map chrome's EDGE plus the dock's own mx-2). */
export const MINIMIZED_BAR_SIDE = 12;

/** Height the portrait reopen bar takes from the bottom of the screen; the grid readouts sit on top of it. */
export function minimizedBarSize(insetBottom: number): number {
  return Math.max(insetBottom, MINIMIZED_BAR_MARGIN) + MINIMIZED_BAR_HEIGHT;
}
/** Release velocity (points/s) above which the sheet moves one detent in the fling direction. */
export const FLING_VELOCITY = 800;

/** Bottom-sheet heights (including the bottom safe area), ascending: peek ≤ half ≤ full. */
export function detentHeights(m: PanelMetrics): Record<Detent, number> {
  const full = Math.max(PEEK_HEIGHT, m.height - m.topReserved);
  const half = Math.min(full, Math.max(MIN_HALF_HEIGHT, Math.round(m.height * HALF_FRACTION)));
  const peek = Math.min(half, PEEK_HEIGHT + m.insets.bottom);
  return { peek, half, full };
}

/**
 * Detents no taller than the content needs (`contentHeight`: the scroll content, bottom padding included; `chrome`: what sits
 * above it, the edge and the grip row or pinned header), so a short
 * menu opens just tall enough. Null (not measured yet, or the keyboard is up) leaves them as they are.
 */
export function fitToContent(heights: Record<Detent, number>, contentHeight: number | null, chrome = SHEET_CHROME_HEIGHT): Record<Detent, number> {
  if (contentHeight === null) return heights;
  const fit = contentHeight + chrome;
  return { peek: Math.min(heights.peek, fit), half: Math.min(heights.half, fit), full: Math.min(heights.full, fit) };
}

/** Left drawer width from the screen's left edge (includes the left safe area). */
export function drawerWidth(m: PanelMetrics): number {
  return m.insets.left + Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, Math.round(m.width * DRAWER_FRACTION)));
}

/**
 * Index of the stop to settle on after a drag. `stops` ascend; `velocity` is positive when the
 * panel is growing. A fling moves one stop in its direction; a slow release picks the nearest.
 */
export function snapIndex(position: number, velocity: number, stops: readonly number[]): number {
  'worklet';
  if (velocity > FLING_VELOCITY) {
    for (let i = 0; i < stops.length; i++) if (stops[i] > position + 1) return i;
    return stops.length - 1;
  }
  if (velocity < -FLING_VELOCITY) {
    for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < position - 1) return i;
    return 0;
  }
  let nearest = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(stops[i] - position) < Math.abs(stops[nearest] - position)) nearest = i;
  }
  return nearest;
}
