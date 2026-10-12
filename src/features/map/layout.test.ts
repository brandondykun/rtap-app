import { EDGE, GAP, isLandscape, LOGO_WIDTH, ornamentPositions, READOUT_HEIGHT, TOOLBAR_HEIGHT } from './layout';

const insets = { top: 47, right: 0, bottom: 34, left: 0 };

describe('map layout', () => {
  it('detects landscape', () => {
    expect(isLandscape(844, 390)).toBe(true);
    expect(isLandscape(390, 844)).toBe(false);
  });

  it('keeps the logo below the full-width toolbar in portrait', () => {
    const p = ornamentPositions({ landscape: false, insets });
    expect(p.logo).toEqual({ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP, left: EDGE });
    expect(p.attribution).toEqual({ top: p.logo.top, left: EDGE + LOGO_WIDTH });
  });

  it('puts the logo top-left in landscape (toolbar is top-right)', () => {
    const p = ornamentPositions({ landscape: true, insets: { top: 0, right: 47, bottom: 21, left: 47 } });
    expect(p.logo).toEqual({ top: EDGE, left: 47 + EDGE });
  });

  it('places the scale bar above the readout card', () => {
    const p = ornamentPositions({ landscape: false, insets });
    expect(p.scaleBar).toEqual({ bottom: insets.bottom + EDGE + READOUT_HEIGHT + GAP, left: EDGE });
  });
});
