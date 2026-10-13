import { themeColors } from '@/theme/tokens';

import {
  DRAFT_SYMBOL_STYLE,
  LINE_DASH,
  LINE_WIDTHS,
  makeLineHaloStyle,
  makeLineStyle,
  MARKER_ICON_SIZE,
  POINT_ICON_SIZE,
  POINT_SYMBOL_STYLE,
} from './styles';

describe('symbol sizes', () => {
  it('draws point (control-measure) symbols smaller than unit symbols, on the map and as the draft', () => {
    expect(POINT_ICON_SIZE).toBeLessThan(MARKER_ICON_SIZE);
    const bySize = ['match', ['get', 'category'], 'point', POINT_ICON_SIZE, MARKER_ICON_SIZE];
    expect(POINT_SYMBOL_STYLE.iconSize).toEqual(bySize);
    expect(DRAFT_SYMBOL_STYLE.iconSize).toEqual(bySize);
  });
});

describe('line styles', () => {
  const colors = themeColors('dark');
  it('draws in friendly blue over a 2 pt wider dark halo, sized by width class', () => {
    expect(LINE_WIDTHS).toEqual({ normal: 3, heavy: 5, wide: 7 });
    const width = ['match', ['get', 'width'], 'heavy', 5, 'wide', 7, 3];
    expect(makeLineStyle(colors)).toMatchObject({ lineColor: colors.friendly, lineWidth: width });
    expect(makeLineHaloStyle(colors)).toMatchObject({ lineColor: colors['point-symbol-halo'], lineWidth: ['+', width, 2] });
    expect(LINE_DASH).toEqual([2, 1.5]);
  });
});
