import type { PanelFrame } from '@/components/menu/panel-geometry';

/** The map view (points) and the panel covering part of it when a picture was taken. */
export type MapArea = { view: { width: number; height: number }; panel: PanelFrame | null };

export type CropRect = { originX: number; originY: number; width: number; height: number };

/** Below this share of the map left uncovered, a picture is not worth keeping. */
export const MIN_VISIBLE_SHARE = 0.3;

/**
 * The part of a captured map image that was not under the open panel, in image pixels. The camera
 * centers the crosshair in that part, so the crop shows what you saw. Works from shares of the view,
 * so the image's resolution (screen size, pixel density) does not matter. Null when the panel left
 * too little of the map.
 */
export function visibleRect(image: { width: number; height: number }, { view, panel }: MapArea): CropRect | null {
  const whole = { originX: 0, originY: 0, width: image.width, height: image.height };
  if (!panel || view.width <= 0 || view.height <= 0) return whole;
  const extent = panel.side === 'left' ? view.width : view.height;
  const share = Math.min(1, Math.max(0, 1 - panel.size / extent));
  if (share < MIN_VISIBLE_SHARE) return null;
  if (panel.side === 'left') {
    // The drawer covers the left edge: keep the right part.
    const width = Math.round(image.width * share);
    return { originX: image.width - width, originY: 0, width, height: image.height };
  }
  // The sheet covers the bottom edge: keep the top part.
  return { originX: 0, originY: 0, width: image.width, height: Math.round(image.height * share) };
}
