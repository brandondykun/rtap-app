import { MGRS_ROW_MIN_WIDTH } from './MgrsInput';
import {
  DRAWER_MAX_WIDTH,
  DRAWER_MIN_WIDTH,
  detentHeights,
  fitToContent,
  SHEET_CHROME_HEIGHT,
  DRAWER_FRACTION,
  RAIL_WIDTH,
  drawerWidth,
  FLING_VELOCITY,
  MIN_HALF_HEIGHT,
  PEEK_HEIGHT,
  snapIndex,
} from './panel-geometry';

const phone = { width: 390, height: 844, insets: { top: 47, right: 0, bottom: 34, left: 0 }, topReserved: 123 };
const phoneLandscape = { width: 844, height: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 }, topReserved: 76 };

describe('panel geometry', () => {
  it('computes ascending detents that leave the toolbar visible', () => {
    const h = detentHeights(phone);
    expect(h.full).toBe(844 - 123);
    expect(h.half).toBe(Math.max(MIN_HALF_HEIGHT, Math.round(844 * 0.42)));
    expect(h.peek).toBe(PEEK_HEIGHT + 34);
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThan(h.full);
  });

  it('shrinks every detent to what short content needs, rail and grip included', () => {
    const h = detentHeights(phone);
    const fitted = fitToContent(h, 200);
    expect(fitted).toEqual({ peek: Math.min(h.peek, 200 + SHEET_CHROME_HEIGHT), half: 200 + SHEET_CHROME_HEIGHT, full: 200 + SHEET_CHROME_HEIGHT });
  });

  it('leaves the detents alone for tall content, or before the content is measured', () => {
    const h = detentHeights(phone);
    expect(fitToContent(h, 2000)).toEqual(h);
    expect(fitToContent(h, null)).toEqual(h);
  });

  it('never lets half exceed full on short screens', () => {
    const h = detentHeights({ ...phone, height: 360, topReserved: 100 });
    expect(h.half).toBeLessThanOrEqual(h.full);
    expect(h.peek).toBeLessThanOrEqual(h.half);
  });

  it('sizes the drawer from the screen width, including the left inset', () => {
    expect(drawerWidth(phoneLandscape)).toBe(47 + Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, Math.round(844 * DRAWER_FRACTION))));
  });

  it('keeps the drawer slim, but wide enough for a full MGRS grid row', () => {
    // iPhone landscape (844 pt): 41% is 346, held at the 350 minimum.
    expect(drawerWidth(phoneLandscape)).toBe(47 + 350);
    expect(drawerWidth({ ...phoneLandscape, width: 1366, insets: { ...phoneLandscape.insets, left: 0 } })).toBe(424);
    // The menu content (minus the hide rail and the section's side padding) fits zone, square and two 5-digit fields.
    const SECTION_PADDING = 32;
    expect(DRAWER_MIN_WIDTH - RAIL_WIDTH - SECTION_PADDING).toBeGreaterThanOrEqual(MGRS_ROW_MIN_WIDTH);
  });

  describe('snapIndex', () => {
    const stops = [130, 354, 721];
    it('snaps to the nearest stop when released slowly', () => {
      expect(snapIndex(200, 0, stops)).toBe(0);
      expect(snapIndex(300, 0, stops)).toBe(1);
      expect(snapIndex(600, 0, stops)).toBe(2);
    });
    it('moves one stop in the fling direction', () => {
      expect(snapIndex(360, FLING_VELOCITY + 1, stops)).toBe(2);
      expect(snapIndex(350, -(FLING_VELOCITY + 1), stops)).toBe(0);
      expect(snapIndex(721, FLING_VELOCITY + 1, stops)).toBe(2);
      expect(snapIndex(130, -(FLING_VELOCITY + 1), stops)).toBe(0);
    });
  });
});
