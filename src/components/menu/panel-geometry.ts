/** The screen area a panel occupies: a bottom sheet's height or a left drawer's width, in points. */
export type PanelFrame = { side: 'bottom' | 'left'; size: number };

export type Detent = 'peek' | 'half' | 'full';

export type PanelMetrics = {
  width: number;
  height: number;
  insets: { top: number; right: number; bottom: number; left: number };
  /** Space at the top a full-height sheet must leave free (safe area + toolbar). */
  topReserved: number;
};

/** Grab handle plus the menu header row. */
export const PEEK_HEIGHT = 96;
export const MIN_HALF_HEIGHT = 300;
export const HALF_FRACTION = 0.42;
export const DRAWER_MIN_WIDTH = 300;
export const DRAWER_MAX_WIDTH = 420;
export const DRAWER_FRACTION = 0.4;
/** Release velocity (points/s) above which the sheet moves one detent in the fling direction. */
export const FLING_VELOCITY = 800;

/** Bottom-sheet heights (including the bottom safe area), ascending: peek ≤ half ≤ full. */
export function detentHeights(m: PanelMetrics): Record<Detent, number> {
  const full = Math.max(PEEK_HEIGHT, m.height - m.topReserved);
  const half = Math.min(full, Math.max(MIN_HALF_HEIGHT, Math.round(m.height * HALF_FRACTION)));
  const peek = Math.min(half, PEEK_HEIGHT + m.insets.bottom);
  return { peek, half, full };
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
