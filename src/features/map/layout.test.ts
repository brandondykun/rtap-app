import {
  ATTRIBUTION_RAISE,
  ATTRIBUTION_WIDTH,
  bannerTop,
  barTakesReadoutSpot,
  cameraPaddingFor,
  CONTROL_SIZE,
  EDGE,
  GAP,
  isLandscape,
  LANDSCAPE_LOGO_TOP,
  LOGO_ROW_HEIGHT,
  ornamentPositions,
  ornamentRowTop,
  roomAboveSheet,
  selfCardClearance,
  TOOLBAR_HEIGHT,
  TOOLBAR_HEIGHT_ICONS,
  toolbarHeight,
} from './layout';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

describe('map layout', () => {
  it('detects landscape', () => {
    expect(isLandscape(844, 390)).toBe(true);
    expect(isLandscape(390, 844)).toBe(false);
  });

  it('puts the (i) button left of the logo and raised by ATTRIBUTION_RAISE, under the toolbar in portrait', () => {
    const p = ornamentPositions({ landscape: false, insets: NO_INSETS });
    const top = EDGE + TOOLBAR_HEIGHT + GAP;
    expect(p.attribution).toEqual({ top: top - ATTRIBUTION_RAISE.portrait, left: EDGE });
    expect(p.logo).toEqual({ top, left: EDGE + ATTRIBUTION_WIDTH });
  });

  it('keeps the logo near the top edge in landscape, with the (i) button raised to line up', () => {
    const p = ornamentPositions({ landscape: true, insets: NO_INSETS });
    expect(p.logo.top).toBe(LANDSCAPE_LOGO_TOP);
    // Only the button's padding may extend past the safe area, never the icon (~half its frame).
    expect(p.attribution.top).toBeGreaterThanOrEqual(-12);
    expect(p.logo.top - p.attribution.top).toBe(ATTRIBUTION_RAISE.landscape);
    expect(p.attribution.left).toBe(EDGE);
  });

  it('adds device insets when the platform measures from the map edges', () => {
    const insets = { top: 47, right: 0, bottom: 34, left: 10 };
    const p = ornamentPositions({ landscape: false, insets });
    expect(p.logo).toEqual({ top: 47 + ornamentRowTop(false), left: 10 + EDGE + ATTRIBUTION_WIDTH });
  });

  it('exposes the logo row height for the location banner', () => {
    expect(LOGO_ROW_HEIGHT).toBe(28);
  });

  it('puts the location banner below both the logo row and the toolbar', () => {
    for (const landscape of [false, true]) {
      expect(bannerTop(landscape)).toBeGreaterThanOrEqual(ornamentRowTop(landscape) + LOGO_ROW_HEIGHT);
      expect(bannerTop(landscape)).toBeGreaterThanOrEqual(EDGE + TOOLBAR_HEIGHT + GAP);
    }
  });

  it('pads the camera by the panel area', () => {
    expect(cameraPaddingFor(null)).toEqual({ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 });
    expect(cameraPaddingFor({ side: 'bottom', size: 320 })).toMatchObject({ paddingBottom: 320, paddingLeft: 0 });
    expect(cameraPaddingFor({ side: 'left', size: 400 })).toMatchObject({ paddingLeft: 400, paddingBottom: 0 });
  });

  it('shifts the logo row right by an offset', () => {
    const p = ornamentPositions({ landscape: true, insets: NO_INSETS, leftOffset: 400 });
    expect(p.attribution.left).toBe(EDGE + 400);
    expect(p.logo.left).toBe(EDGE + 400 + ATTRIBUTION_WIDTH);
  });

  it('gives the readout spot to an action bar only in landscape with a drawer open', () => {
    const drawer = { side: 'left', size: 360 } as const;
    expect(barTakesReadoutSpot(true, drawer, true)).toBe(true);
    expect(barTakesReadoutSpot(true, drawer, false)).toBe(false);
    expect(barTakesReadoutSpot(true, null, true)).toBe(false);
    expect(barTakesReadoutSpot(false, { side: 'bottom', size: 300 }, true)).toBe(false);
  });

  it('measures the room between north-up and a bottom sheet', () => {
    const below = EDGE + TOOLBAR_HEIGHT + GAP + CONTROL_SIZE + GAP + EDGE;
    expect(roomAboveSheet(800, { side: 'bottom', size: 300 }, 20, TOOLBAR_HEIGHT)).toBe(800 - 300 - 20 - below);
    expect(roomAboveSheet(800, { side: 'left', size: 300 }, 20, TOOLBAR_HEIGHT)).toBe(Infinity);
    expect(roomAboveSheet(800, null, 20, TOOLBAR_HEIGHT)).toBe(Infinity);
  });

  it('keeps bottom bars beside or above your grid card, and clear of the zoom column', () => {
    const card = { width: 250, height: 64 };
    expect(selfCardClearance(card, true)).toEqual({ lift: 0, left: 250 + GAP, right: CONTROL_SIZE + GAP });
    expect(selfCardClearance(card, false)).toEqual({ lift: 64 + GAP, left: 0, right: CONTROL_SIZE + GAP });
    expect(selfCardClearance({ width: 0, height: 0 }, true)).toEqual({ lift: 0, left: 0, right: CONTROL_SIZE + GAP });
  });

  it('shrinks the toolbar when its text is hidden, and moves what sits under it up to match', () => {
    expect(toolbarHeight(true)).toBe(TOOLBAR_HEIGHT);
    expect(toolbarHeight(false)).toBe(TOOLBAR_HEIGHT_ICONS);
    expect(TOOLBAR_HEIGHT_ICONS).toBeLessThan(TOOLBAR_HEIGHT);
    const shrink = TOOLBAR_HEIGHT - TOOLBAR_HEIGHT_ICONS;
    expect(ornamentRowTop(false, TOOLBAR_HEIGHT_ICONS)).toBe(ornamentRowTop(false) - shrink);
    expect(bannerTop(false, TOOLBAR_HEIGHT_ICONS)).toBe(bannerTop(false) - shrink);
    expect(ornamentPositions({ landscape: false, insets: NO_INSETS, toolbarHeight: TOOLBAR_HEIGHT_ICONS }).logo.top).toBe(EDGE + TOOLBAR_HEIGHT_ICONS + GAP);
    // Landscape: the logo row is beside the toolbar, not under it.
    expect(ornamentRowTop(true, TOOLBAR_HEIGHT_ICONS)).toBe(ornamentRowTop(true));
  });
});
