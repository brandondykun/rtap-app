import { POINT_TYPES, sidcForPointType } from '@/features/symbology/point-types';
import { themeColors } from '@/theme/tokens';

import {
  DRAFT_SYMBOL_STYLE,
  LABEL_TEXT_SIZES,
  LINE_DASH,
  LINE_WIDTHS,
  makeDraftLabelStyle,
  makeLineHaloStyle,
  makeLineLabelStyle,
  makeLineStyle,
  makePointLabelStyle,
  makePolygonFillStyle,
  makePolygonLabelStyle,
  MARKER_ICON_SIZE,
  POINT_ICON_SIZE,
  POINT_SYMBOL_STYLE,
  POLYGON_FILL_OPACITY,
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

describe('polygon styles', () => {
  it('fills in light friendly blue', () => {
    const colors = themeColors('dark');
    expect(makePolygonFillStyle(colors)).toEqual({ fillColor: colors.friendly, fillOpacity: POLYGON_FILL_OPACITY });
    expect(POLYGON_FILL_OPACITY).toBe(0.15);
  });
});

describe('label text sizes', () => {
  const colors = themeColors('dark');
  const pt = (style: { textOffset?: unknown; textSize?: unknown }, axis: 0 | 1) => (style.textOffset as number[])[axis] * (style.textSize as number);
  /** The point label's distance below the symbol in pt, for a feature with this SIDC (evaluates the `match`). */
  const pointGap = (style: { textOffset?: unknown; textSize?: unknown }, sidc: string) => {
    const [, , sidcs, pin, other] = style.textOffset as [string, unknown, string[], ['literal', number[]], ['literal', number[]]];
    return (sidcs.includes(sidc) ? pin : other)[1][1] * (style.textSize as number);
  };

  it('is small, medium (the default, 12 pt) or large', () => {
    expect(LABEL_TEXT_SIZES.medium).toBe(12);
    expect(LABEL_TEXT_SIZES.small).toBeLessThan(12);
    expect(LABEL_TEXT_SIZES.large).toBeGreaterThan(12);
    expect(makePointLabelStyle(colors).textSize).toBe(12);
  });

  it('sizes every item label and keeps each at the same distance from its symbol', () => {
    for (const size of Object.values(LABEL_TEXT_SIZES)) {
      expect(makePointLabelStyle(colors, size).textSize).toBe(size);
      expect(makeLineLabelStyle(colors, size).textSize).toBe(size);
      expect(makePolygonLabelStyle(colors, size).textSize).toBe(size);
      expect(makeDraftLabelStyle(colors, size).textSize).toBe(size);
      // Offsets are in ems, so they must shrink as the text grows to stay put in points.
      for (const t of POINT_TYPES) expect(pointGap(makePointLabelStyle(colors, size), t.sidc)).toBeCloseTo(pointGap(makePointLabelStyle(colors), t.sidc));
      expect(pt(makeLineLabelStyle(colors, size), 0)).toBeCloseTo(pt(makeLineLabelStyle(colors), 0));
      expect(pt(makeDraftLabelStyle(colors, size), 1)).toBeCloseTo(pt(makeDraftLabelStyle(colors), 1));
    }
  });

  it('puts labels of pin-shaped points (CKP, SP, RP, RLY, LU) closer: the pin draws above its tip, not around it', () => {
    const style = makePointLabelStyle(colors);
    const pins = (['checkpoint', 'start-point', 'release-point', 'rally-point', 'linkup-point'] as const).map(sidcForPointType);
    const others = POINT_TYPES.map((t) => t.sidc).filter((s) => !pins.includes(s));
    for (const sidc of pins) expect(pointGap(style, sidc)).toBeLessThan(8);
    for (const sidc of [...others, 'SFGPUCI----D---']) expect(pointGap(style, sidc)).toBeCloseTo(15.6);
  });
});
