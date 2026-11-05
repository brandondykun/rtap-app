import { MGRS_ROW_MIN_WIDTH } from './MgrsInput';
import {
  DRAWER_MAX_WIDTH,
  DRAWER_MIN_WIDTH,
  detentHeights,
  fitToContent,
  fieldTopScrollY,
  focusedFieldScrollY,
  FOCUSED_FIELD_MARGIN,
  SHEET_CHROME_HEIGHT,
  DRAWER_FRACTION,
  RAIL_WIDTH,
  drawerWidth,
  FLING_VELOCITY,
  MENU_DETENTS,
  MIN_HALF_HEIGHT,
  PEEK_HEIGHT,
  keyboardRoom,
  snapIndex,
} from './panel-geometry';

const phone = { width: 390, height: 844, insets: { top: 47, right: 0, bottom: 34, left: 0 }, topReserved: 123 };
const phoneLandscape = { width: 844, height: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 }, topReserved: 76 };

describe('panel geometry', () => {
  it('computes ascending detents that leave the toolbar visible', () => {
    const h = detentHeights(phone);
    expect(h.full).toBe(844 - 123);
    expect(h.half).toBe(Math.max(MIN_HALF_HEIGHT, Math.round(844 * 0.42)));
    expect(h.tall).toBe(Math.round(844 * 0.55));
    expect(h.peek).toBe(PEEK_HEIGHT + 34);
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThan(h.tall);
    expect(h.tall).toBeLessThan(h.full);
  });

  it('gives menus four snap points, the extra one about half way between half and full', () => {
    expect(MENU_DETENTS).toEqual(['peek', 'half', 'tall', 'full']);
    const h = detentHeights(phone);
    expect(MENU_DETENTS.map((d) => h[d])).toEqual([...MENU_DETENTS.map((d) => h[d])].sort((a, b) => a - b));
    // Past the half-screen line, where the map's grid readouts give way to the menu.
    expect(h.tall).toBeGreaterThan(844 / 2);
  });

  it('shrinks every detent to what short content needs, rail and grip included', () => {
    const h = detentHeights(phone);
    const fitted = fitToContent(h, 200);
    expect(fitted).toEqual({ peek: Math.min(h.peek, 200 + SHEET_CHROME_HEIGHT), half: 200 + SHEET_CHROME_HEIGHT, tall: 200 + SHEET_CHROME_HEIGHT, full: 200 + SHEET_CHROME_HEIGHT });
  });

  it('leaves the detents alone for tall content, or before the content is measured', () => {
    const h = detentHeights(phone);
    expect(fitToContent(h, 2000)).toEqual(h);
    expect(fitToContent(h, null)).toEqual(h);
  });

  it('never lets half or tall exceed full on short screens', () => {
    const h = detentHeights({ ...phone, height: 360, topReserved: 100 });
    expect(h.half).toBeLessThanOrEqual(h.tall);
    expect(h.tall).toBeLessThanOrEqual(h.full);
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

  describe('keyboardRoom', () => {
    it('is the keyboard and its bar while it is up, nothing once it is down', () => {
      expect(keyboardRoom(300, 42)).toBe(342);
      expect(keyboardRoom(0, 42)).toBe(0);
    });

    it('shrinks with the keyboard as it goes down, the bar with it, reaching 0 together', () => {
      expect(keyboardRoom(150, 42, 0.5)).toBe(171);
      expect(keyboardRoom(0, 42, 0)).toBe(0);
    });
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

  describe('fieldTopScrollY', () => {
    it('scrolls a field to just under the top of the panel', () => {
      expect(fieldTopScrollY(400)).toBe(400 - FOCUSED_FIELD_MARGIN);
    });
    it('never scrolls above the start of the content', () => {
      expect(fieldTopScrollY(3)).toBe(0);
    });
  });

  describe('focusedFieldScrollY', () => {
    const viewport = { x: 0, y: 50, width: 300 };
    it('scrolls a field in the panel to just under its top edge', () => {
      expect(focusedFieldScrollY(30, { x: 20, y: 400 }, viewport)).toBe(30 + 400 - 50 - FOCUSED_FIELD_MARGIN);
    });
    it('never scrolls above the start of the content', () => {
      expect(focusedFieldScrollY(0, { x: 20, y: 52 }, viewport)).toBe(0);
    });
    it('leaves the panel alone for a field outside it', () => {
      expect(focusedFieldScrollY(30, { x: 320, y: 400 }, viewport)).toBeNull();
    });
  });
});
