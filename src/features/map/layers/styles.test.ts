import { DRAFT_SYMBOL_STYLE, MARKER_ICON_SIZE, POINT_ICON_SIZE, POINT_SYMBOL_STYLE } from './styles';

describe('symbol sizes', () => {
  it('draws point (control-measure) symbols smaller than unit symbols, on the map and as the draft', () => {
    expect(POINT_ICON_SIZE).toBeLessThan(MARKER_ICON_SIZE);
    const bySize = ['match', ['get', 'category'], 'point', POINT_ICON_SIZE, MARKER_ICON_SIZE];
    expect(POINT_SYMBOL_STYLE.iconSize).toEqual(bySize);
    expect(DRAFT_SYMBOL_STYLE.iconSize).toEqual(bySize);
  });
});
