import { ATTRIBUTION_RAISE, EDGE, GAP, isLandscape, LOGO_ROW_HEIGHT, LOGO_WIDTH, ornamentPositions, TOOLBAR_HEIGHT } from './layout';

const insets = { top: 47, right: 0, bottom: 34, left: 0 };

describe('map layout', () => {
  it('detects landscape', () => {
    expect(isLandscape(844, 390)).toBe(true);
    expect(isLandscape(390, 844)).toBe(false);
  });

  it('keeps the logo below the full-width toolbar in portrait', () => {
    const p = ornamentPositions({ landscape: false, insets });
    expect(p.logo).toEqual({ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP, left: EDGE });
    expect(p.attribution).toEqual({ top: p.logo.top - ATTRIBUTION_RAISE, left: EDGE + LOGO_WIDTH });
  });

  it('puts the logo top-left in landscape (toolbar is top-right)', () => {
    const p = ornamentPositions({ landscape: true, insets: { top: 0, right: 47, bottom: 21, left: 47 } });
    expect(p.logo).toEqual({ top: EDGE, left: 47 + EDGE });
  });

  it('exposes the logo row height for the location banner', () => {
    expect(LOGO_ROW_HEIGHT).toBe(28);
  });
});
