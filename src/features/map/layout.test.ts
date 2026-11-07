import {
  ANDROID_ATTRIBUTION,
  ATTRIBUTION_RAISE,
  ATTRIBUTION_WIDTH,
  bannerTop,
  cameraPaddingFor,
  CONTROL_SIZE,
  EDGE,
  GAP,
  isLandscape,
  LOGO_ROW_HEIGHT,
  ornamentPositions,
  ornamentRowTop,
  roomAboveSheet,
  selfCardClearance,
  TOOLBAR_HEIGHT,
  TOOLBAR_HEIGHT_ICONS,
  toastTop,
  toolbarHeight,
} from './layout';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

describe('map layout', () => {
  it('detects landscape', () => {
    expect(isLandscape(844, 390)).toBe(true);
    expect(isLandscape(390, 844)).toBe(false);
  });

  it('puts the (i) button left of the logo and raised by ATTRIBUTION_RAISE, under the toolbar', () => {
    const p = ornamentPositions({ insets: NO_INSETS });
    const top = EDGE + TOOLBAR_HEIGHT + GAP;
    expect(p.attribution).toEqual({ top: top - ATTRIBUTION_RAISE, left: EDGE });
    expect(p.logo).toEqual({ top, left: EDGE + ATTRIBUTION_WIDTH });
  });

  it('on Android, raises the (i) icon only by its own amount and moves it right beside the logo', () => {
    const p = ornamentPositions({ insets: NO_INSETS, android: true });
    expect(p.logo.top - p.attribution.top).toBe(ANDROID_ATTRIBUTION.raise);
    expect(p.attribution.left).toBe(EDGE + ANDROID_ATTRIBUTION.right);
    expect(p.logo.left).toBe(EDGE + ATTRIBUTION_WIDTH);
  });

  it('adds device insets when the platform measures from the map edges', () => {
    const insets = { top: 47, right: 0, bottom: 34, left: 10 };
    const p = ornamentPositions({ insets });
    expect(p.logo).toEqual({ top: 47 + ornamentRowTop(), left: 10 + EDGE + ATTRIBUTION_WIDTH });
  });

  it('exposes the logo row height for the location banner', () => {
    expect(LOGO_ROW_HEIGHT).toBe(28);
  });

  it('puts the logo row below the toolbar (so the landscape toolbar, however wide, never covers it), and the location banner below both', () => {
    expect(ornamentRowTop()).toBeGreaterThanOrEqual(EDGE + TOOLBAR_HEIGHT + GAP);
    expect(bannerTop()).toBeGreaterThanOrEqual(ornamentRowTop() + LOGO_ROW_HEIGHT);
  });

  it('puts a toast below the logo row and the north button in portrait, where they sit under the toolbar', () => {
    // The north button (the taller of the two) starts at the logo row's top.
    expect(toastTop(TOOLBAR_HEIGHT, false)).toBe(ornamentRowTop() + CONTROL_SIZE + GAP);
    expect(toastTop(TOOLBAR_HEIGHT, false)).toBeGreaterThanOrEqual(ornamentRowTop() + LOGO_ROW_HEIGHT + GAP);
    // Landscape: right under the toolbar, as before (the north button sits beside the toolbar there).
    expect(toastTop(TOOLBAR_HEIGHT, true)).toBe(EDGE + TOOLBAR_HEIGHT + GAP);
    expect(toastTop(TOOLBAR_HEIGHT_ICONS, false)).toBe(toastTop(TOOLBAR_HEIGHT, false) - (TOOLBAR_HEIGHT - TOOLBAR_HEIGHT_ICONS));
  });

  it('pads the camera by the panel area', () => {
    expect(cameraPaddingFor(null)).toEqual({ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 });
    expect(cameraPaddingFor({ side: 'bottom', size: 320 })).toMatchObject({ paddingBottom: 320, paddingLeft: 0 });
    expect(cameraPaddingFor({ side: 'left', size: 400 })).toMatchObject({ paddingLeft: 400, paddingBottom: 0 });
  });

  it('shifts the logo row right by an offset', () => {
    const p = ornamentPositions({ insets: NO_INSETS, leftOffset: 400 });
    expect(p.attribution.left).toBe(EDGE + 400);
    expect(p.logo.left).toBe(EDGE + 400 + ATTRIBUTION_WIDTH);
  });

  it('measures the room between north-up and a bottom sheet', () => {
    const below = EDGE + TOOLBAR_HEIGHT + GAP + CONTROL_SIZE + GAP + EDGE;
    expect(roomAboveSheet(800, { side: 'bottom', size: 300 }, 20, TOOLBAR_HEIGHT)).toBe(800 - 300 - 20 - below);
    expect(roomAboveSheet(800, { side: 'left', size: 300 }, 20, TOOLBAR_HEIGHT)).toBe(Infinity);
    expect(roomAboveSheet(800, null, 20, TOOLBAR_HEIGHT)).toBe(Infinity);
  });

  it('keeps bottom bars beside or above your card (bottom right), and only clear of the zoom column while it is hidden', () => {
    const card = { width: 250, height: 64 };
    expect(selfCardClearance(card, true)).toEqual({ lift: 0, right: 250 + GAP });
    expect(selfCardClearance(card, false)).toEqual({ lift: 64 + GAP, right: CONTROL_SIZE + GAP });
    expect(selfCardClearance({ width: 0, height: 0 }, true)).toEqual({ lift: 0, right: CONTROL_SIZE + GAP });
  });

  it('shrinks the toolbar when its text is hidden, and moves what sits under it up to match', () => {
    expect(toolbarHeight(true)).toBe(TOOLBAR_HEIGHT);
    expect(toolbarHeight(false)).toBe(TOOLBAR_HEIGHT_ICONS);
    expect(TOOLBAR_HEIGHT_ICONS).toBeLessThan(TOOLBAR_HEIGHT);
    const shrink = TOOLBAR_HEIGHT - TOOLBAR_HEIGHT_ICONS;
    expect(ornamentRowTop(TOOLBAR_HEIGHT_ICONS)).toBe(ornamentRowTop() - shrink);
    expect(bannerTop(TOOLBAR_HEIGHT_ICONS)).toBe(bannerTop() - shrink);
    expect(ornamentPositions({ insets: NO_INSETS, toolbarHeight: TOOLBAR_HEIGHT_ICONS }).logo.top).toBe(EDGE + TOOLBAR_HEIGHT_ICONS + GAP);
  });
});
