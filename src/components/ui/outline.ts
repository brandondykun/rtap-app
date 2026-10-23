import { PixelRatio } from 'react-native';

/** How far each dark copy sits from the text or icon, in device pixels: the thinnest edge there is, like the map crosshair's. */
const EDGE = 1;
const DIRECTIONS = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => [x, y] as const)).filter(([x, y]) => x !== 0 || y !== 0);

/**
 * Where to draw the eight dark copies under a text or icon glyph, in pt, to give it a crisp edge. React Native cannot
 * stroke text, so the copies, shifted one device pixel each way, stand in for one.
 */
export function outlineShifts(): (readonly [number, number])[] {
  const shift = EDGE / PixelRatio.get();
  return DIRECTIONS.map(([x, y]) => [x * shift, y * shift] as const);
}

/** Keeps the dark copies away from screen readers, so the glyph is read once. */
export const OUTLINE_HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
