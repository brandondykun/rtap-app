import {
  ATTRIBUTION_RAISE,
  ATTRIBUTION_WIDTH,
  EDGE,
  GAP,
  isLandscape,
  LANDSCAPE_LOGO_TOP,
  LOGO_ROW_HEIGHT,
  ornamentPositions,
  ornamentRowTop,
  TOOLBAR_HEIGHT,
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
    expect(p.attribution.top).toBeGreaterThanOrEqual(-EDGE);
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
});
