import { POINT_TYPES, sidcForPointType } from '@/features/symbology/point-types';
import { gridShadeColors, themeColors } from '@/theme/tokens';

import { LABEL_CHIP_CONTENT_INSET_PT } from '../images/map-image-specs';
import { MAP_IMAGE_IDS } from '../images/map-images';

import {
  DRAFT_SYMBOL_STYLE,
  LABEL_TEXT_SIZES,
  LINE_DASH,
  LINE_WIDTHS,
  makeDraftLabelStyle,
  makeGridAreaLabelStyle,
  makeGridLineLabelStyle,
  makeLineDashedStyle,
  makeLineHaloStyle,
  makeLineLabelStyle,
  makeLineStyle,
  makePointLabelStyle,
  makePolygonFillStyle,
  makePolygonLabelStyle,
  makePolygonOutlineDashedStyle,
  makePolygonOutlineStyle,
  makeRingFillStyle,
  makeRingHaloStyle,
  makeRingLineStyle,
  RING_FILL_OPACITY,
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

/** Evaluates the few style expression operators the line labels use, for one feature's properties. */
function evaluate(expr: unknown, props: Record<string, unknown>): unknown {
  if (!Array.isArray(expr)) return expr;
  const [op, ...args] = expr as [string, ...unknown[]];
  const v = (e: unknown) => evaluate(e, props) as number;
  switch (op) {
    case 'literal':
      return args[0];
    case 'coalesce':
      return args.map((a) => evaluate(a, props)).find((x) => x !== undefined && x !== null);
    case 'get':
      return props[args[0] as string];
    case '+':
      return args.reduce<number>((sum, a) => sum + v(a), 0);
    case '-':
      return v(args[0]) - v(args[1]);
    case '%':
      return v(args[0]) % v(args[1]);
    case '<':
      return v(args[0]) < v(args[1]);
    case 'case':
      return evaluate(evaluate(args[0], props) ? args[1] : args[2], props);
    case 'match': {
      // ['match', input, label(s), output, …, fallback]
      const input = evaluate(args[0], props);
      for (let i = 1; i + 1 < args.length; i += 2) {
        const labels = Array.isArray(args[i]) ? (args[i] as unknown[]) : [args[i]];
        if (labels.includes(input)) return evaluate(args[i + 1], props);
      }
      return evaluate(args[args.length - 1], props);
    }
    case '==':
      return evaluate(args[0], props) === evaluate(args[1], props);
    case 'slice':
      return (evaluate(args[0], props) as string).slice(v(args[1]), v(args[2]));
    case 'interpolate': {
      // ['interpolate', ['linear'], input, stop, output, …] with number-array outputs.
      const x = v(args[1]);
      const stops = args.slice(2);
      for (let i = 0; i + 3 < stops.length; i += 2) {
        const [x0, x1] = [stops[i] as number, stops[i + 2] as number];
        if (x > x1) continue;
        const [y0, y1] = [evaluate(stops[i + 1], props), evaluate(stops[i + 3], props)] as number[][];
        const t = (x - x0) / (x1 - x0);
        return y0.map((y, k) => y + t * (y1[k] - y));
      }
      return evaluate(stops[stops.length - 1], props);
    }
    default:
      throw new Error(`unsupported operator ${op}`);
  }
}

describe('line end labels', () => {
  const colors = themeColors('dark');
  const rad = (deg: number) => (deg * Math.PI) / 180;
  /** Turns a map-frame vector (x right, y down) clockwise by `deg`, as Mapbox turns a rotated symbol. */
  const turn = ([x, y]: number[], deg: number) => [x * Math.cos(rad(deg)) - y * Math.sin(rad(deg)), x * Math.sin(rad(deg)) + y * Math.cos(rad(deg))];
  /** How an end label with this outward bearing draws while the map is turned to `mapBearing`. */
  const label = (bearing: number, mapBearing: number, size = LABEL_TEXT_SIZES.medium) => {
    const style = makeLineLabelStyle(colors, size, mapBearing);
    const at = (e: unknown) => evaluate(e, { bearing });
    const rotate = at(style.textRotate) as number;
    const textPt = (at(style.textOffset) as number[]).map((o) => o * size);
    const iconPt = at(style.iconOffset) as number[];
    return {
      style,
      /** Reading direction on screen, degrees clockwise from screen-up: 90 reads left to right. */
      reads: (((rotate + 90 - mapBearing) % 360) + 360) % 360,
      anchor: at(style.textAnchor),
      iconRotate: at(style.iconRotate),
      // Mapbox moves the text by its offset without turning it, but fits the chip around the offset
      // text box (plus the icon offset) and then turns the chip: both must land at the same spot.
      textAt: textPt,
      chipAt: turn([textPt[0] + iconPt[0], textPt[1] + iconPt[1]], rotate),
    };
  };
  /** The point `gap` pt past the end, along its outward bearing, in the map frame. */
  const pastEnd = (bearing: number, gap = 10.8) => [gap * Math.sin(rad(bearing)), -gap * Math.cos(rad(bearing))];
  const expectAt = (actual: number[], expected: number[]) => {
    expect(actual[0]).toBeCloseTo(expected[0], 0);
    expect(actual[1]).toBeCloseTo(expected[1], 0);
  };

  it('turns with the map and follows the end segment, its chip turning with it', () => {
    const l = label(30, 0);
    expect(l.style).toMatchObject({ textRotationAlignment: 'map', iconRotationAlignment: 'map' });
    expect(l.iconRotate).toBe(evaluate(l.style.textRotate, { bearing: 30 }));
    expect(l.reads).toBeCloseTo(30);
  });

  it('sits on the square chip, which stays in one piece when turned', () => {
    expect(makeLineLabelStyle(colors).iconImage).toBe(MAP_IMAGE_IDS.labelChipSquare);
  });

  it('reads outward from the end when that points right on screen, starting just past the end', () => {
    for (const [bearing, mapBearing] of [[90, 0], [0, 0], [10, 300], [300, 200], [120, 0], [37, 0]]) {
      const l = label(bearing, mapBearing);
      expect(l.reads).toBeCloseTo((((bearing - mapBearing) % 360) + 360) % 360);
      expect(l.anchor).toBe('left');
      expectAt(l.textAt, pastEnd(bearing));
      expectAt(l.chipAt, pastEnd(bearing));
    }
  });

  it('never reads upside down: an end pointing left on screen reads toward the end, finishing just past it', () => {
    for (const [bearing, mapBearing] of [[270, 0], [180, 0], [200, 10], [90, 180], [300, 0], [217, 0]]) {
      const l = label(bearing, mapBearing);
      expect(l.reads).toBeLessThan(180);
      expect(l.anchor).toBe('right');
      expectAt(l.textAt, pastEnd(bearing));
      expectAt(l.chipAt, pastEnd(bearing));
    }
  });

  it('keeps the same gap past the end at every text size', () => {
    for (const size of Object.values(LABEL_TEXT_SIZES)) {
      const l = label(120, 0, size);
      expectAt(l.textAt, pastEnd(120));
      expectAt(l.chipAt, pastEnd(120));
    }
  });
});

describe('polygon styles', () => {
  it('fills lightly in friendly blue, or hostile red for a hostile-colored type', () => {
    const colors = themeColors('dark');
    const fill = makePolygonFillStyle(colors);
    expect(POLYGON_FILL_OPACITY).toBe(0.15);
    // Each polygon's own fill, or the light default.
    expect(evaluate(fill.fillOpacity, { opacity: 0.5 })).toBe(0.5);
    expect(evaluate(fill.fillOpacity, { opacity: 0 })).toBe(0);
    expect(evaluate(fill.fillOpacity, {})).toBe(POLYGON_FILL_OPACITY);
    expect(evaluate(fill.fillColor, {})).toBe(colors.friendly);
    expect(evaluate(fill.fillColor, { color: 'friendly' })).toBe(colors.friendly);
    expect(evaluate(fill.fillColor, { color: 'hostile' })).toBe(colors.hostile);
  });

  it('draws outlines like lines, in the same color as the fill', () => {
    const colors = themeColors('dark');
    for (const [outline, line] of [
      [makePolygonOutlineStyle(colors), makeLineStyle(colors)],
      [makePolygonOutlineDashedStyle(colors), makeLineDashedStyle(colors)],
    ]) {
      expect({ ...outline, lineColor: undefined }).toEqual({ ...line, lineColor: undefined });
      expect(evaluate(outline.lineColor, { color: 'hostile' })).toBe(colors.hostile);
      expect(evaluate(outline.lineColor, { color: 'friendly' })).toBe(colors.friendly);
    }
  });
});

describe('label text sizes', () => {
  const colors = themeColors('dark');
  const pt = (style: { textOffset?: unknown; textSize?: unknown }, axis: 0 | 1) => (style.textOffset as number[])[axis] * (style.textSize as number);
  /** The point label's distance below the symbol in pt, for a feature with this SIDC. */
  const pointGap = (style: { textOffset?: unknown; textSize?: unknown }, sidc: string) =>
    (evaluate(style.textOffset, { sidc }) as number[])[1] * (style.textSize as number);
  const HOSTILE_UNIT = 'SHGPUCI----D---';
  const FRIENDLY_UNIT = 'SFGPUCI----D---';

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
      for (const sidc of [...POINT_TYPES.map((t) => t.sidc), HOSTILE_UNIT, FRIENDLY_UNIT]) {
        expect(pointGap(makePointLabelStyle(colors, size), sidc)).toBeCloseTo(pointGap(makePointLabelStyle(colors), sidc));
      }
      expect(pt(makeDraftLabelStyle(colors, size), 1)).toBeCloseTo(pt(makeDraftLabelStyle(colors), 1));
    }
  });

  it('puts labels of pin-shaped points (CKP, SP, RP, RLY, LU) closer: the pin draws above its tip, not around it', () => {
    const style = makePointLabelStyle(colors);
    const pins = (['checkpoint', 'start-point', 'release-point', 'rally-point', 'linkup-point'] as const).map(sidcForPointType);
    const op = sidcForPointType('observation-post');
    const others = POINT_TYPES.map((t) => t.sidc).filter((s) => !pins.includes(s) && s !== op);
    for (const sidc of pins) expect(pointGap(style, sidc)).toBeLessThan(8);
    for (const sidc of [...others, FRIENDLY_UNIT, 'SNGPUCI----D---', 'SUGPUCI----D---']) expect(pointGap(style, sidc)).toBeCloseTo(15.6);
  });

  it('puts the OP label a little higher and hostile unit labels a little lower than the rest', () => {
    const style = makePointLabelStyle(colors);
    expect(pointGap(style, sidcForPointType('observation-post'))).toBeCloseTo(9.6);
    for (const sidc of [HOSTILE_UNIT, 'SHGPUCA----E---']) expect(pointGap(style, sidc)).toBeCloseTo(18.6);
  });
});

describe('label chip padding', () => {
  const colors = themeColors('dark');
  /** Visible chip around the text in pt, [vertical, horizontal]: the image's own content inset plus the fit padding. */
  const visible = (style: { iconTextFitPadding?: unknown }, contentInset: number) => {
    const [top, right, bottom, left] = style.iconTextFitPadding as number[];
    expect(top).toBe(bottom);
    expect(left).toBe(right);
    return [contentInset + top, contentInset + left];
  };
  const roundedInset = LABEL_CHIP_CONTENT_INSET_PT;

  it('gives point labels a little more room than line labels, and less than before (3 pt high, 5 pt wide)', () => {
    const [pointV, pointH] = visible(makePointLabelStyle(colors), roundedInset);
    // The square line chip has no content inset: the text fits the whole image.
    const [lineV, lineH] = visible(makeLineLabelStyle(colors), 0);
    expect(pointV).toBeGreaterThan(lineV);
    expect(pointH).toBeGreaterThan(lineH);
    expect(pointV).toBeLessThan(3);
    expect(pointH).toBeLessThan(5);
  });

  it('keeps polygon labels the same as point labels', () => {
    expect(makePolygonLabelStyle(colors).iconTextFitPadding).toEqual(makePointLabelStyle(colors).iconTextFitPadding);
  });
});

describe('MGRS grid label styles', () => {
  const colors = gridShadeColors('white');

  it('shrinks the zone names when zoomed far out, so neighbours stay clear of each other', () => {
    expect(makeGridAreaLabelStyle(colors).textSize).toEqual(['interpolate', ['linear'], ['zoom'], 1.5, 9, 3, 13]);
  });

  it('keeps the grid line numbers at 11 pt', () => {
    expect(makeGridLineLabelStyle(colors).textSize).toBe(11);
    expect(makeGridLineLabelStyle(colors, false).textSize).toBe(11);
  });
});

describe('range ring styles', () => {
  const colors = themeColors('dark');
  it('tints with the affiliation color at the ring opacity', () => {
    const fill = makeRingFillStyle(colors);
    expect(fill.fillOpacity).toBe(RING_FILL_OPACITY);
    expect(RING_FILL_OPACITY).toBe(0.12);
    expect(fill.fillColor).toEqual(['match', ['get', 'affiliation'], 'friendly', colors.friendly, 'hostile', colors.hostile, 'neutral', colors.neutral, colors.unknown]);
  });
  it('outlines with a halo and the affiliation color', () => {
    expect(makeRingHaloStyle(colors)).toMatchObject({ lineColor: colors['point-symbol-halo'], lineWidth: 4 });
    expect(makeRingLineStyle(colors)).toMatchObject({ lineWidth: 2 });
  });
});
