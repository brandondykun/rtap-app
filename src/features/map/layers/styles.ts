import type { CircleLayerStyle, FillLayerStyle, LineLayerStyle, SymbolLayerStyle } from '@rnmapbox/maps';

import { sidcForPointType } from '@/features/symbology/point-types';
import type { GridStrength, LabelSize } from '@/stores/settings';
import type { SemanticToken } from '@/theme/tokens';

import { MIN_ZOOM } from '../canvas/camera';
import { MAP_IMAGE_IDS } from '../images/map-images';

/**
 * Font stack for map labels. Glyphs come from the Mapbox style's glyph server; these fonts are
 * available to every account. A monospace stack (JetBrains Mono) needs its glyphs uploaded to
 * the Mapbox account first — tracked in the native gate notes. Every font in a stack must exist,
 * or no labels render.
 */
export const MAP_LABEL_FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

/** Scale for unit symbols (the generated PNGs are ~32 pt tall at 1). */
export const MARKER_ICON_SIZE = 0.8;
/** Scale for point (control-measure overlay) symbols: a little smaller than units. */
export const POINT_ICON_SIZE = 0.76;
/** Per-feature size from its `category` property (set by the selectors from itemCategory). */
const ICON_SIZE_BY_CATEGORY: SymbolLayerStyle['iconSize'] = ['match', ['get', 'category'], 'point', POINT_ICON_SIZE, MARKER_ICON_SIZE];
/** Item label text sizes in pt for the Label text size setting (medium is the original size). */
export const LABEL_TEXT_SIZES: Record<LabelSize, number> = { small: 10, medium: 12, large: 15 };
// Label offsets are in ems; these are the distances in pt (at 12 pt: 1.3, 0.9 and 3.3 em).
const POINT_LABEL_GAP_PT = 15.6;
/** Pin-shaped points mark the spot with their tip, so nothing draws below it: their label sits closer. */
const PIN_LABEL_GAP_PT = 5;
const PIN_POINT_SIDCS = (['checkpoint', 'start-point', 'release-point', 'rally-point', 'linkup-point', 'casualty-collection-point'] as const).map(sidcForPointType);
/** The OP's triangle (and the FO's, the same shape) ends a little above the usual symbol bottom; the hostile diamond reaches a little below it. */
const OP_LABEL_GAP_PT = 9.6;
const HOSTILE_UNIT_LABEL_GAP_PT = 18.6;
const LINE_LABEL_GAP_PT = 10.8;
const DRAFT_LABEL_GAP_PT = 39.6;

/** Chip padding around label text, [top, right, bottom, left] in pt. */
const LABEL_CHIP_PADDING: [number, number, number, number] = [0, 2, 0, 2];
/**
 * Point and polygon chips: the rounded chip already keeps a 3 pt margin inside its image, so this
 * pulls it in to 1.5 pt above and below and 3.5 pt at the sides (a little roomier than line chips).
 */
const POINT_CHIP_PADDING: [number, number, number, number] = [-1.5, 0.5, -1.5, 0.5];

/** Symbol icons: every point always shows; collisions never hide a symbol. */
export const POINT_SYMBOL_STYLE: SymbolLayerStyle = {
  iconImage: ['get', 'sidc'],
  iconSize: ICON_SIZE_BY_CATEGORY,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/** Label chips below each symbol; labels may hide each other when crowded (never the symbols). */
export function makePointLabelStyle(colors: Record<SemanticToken, string>, textSize = LABEL_TEXT_SIZES.medium): SymbolLayerStyle {
  const below = (gapPt: number) => ['literal', [0, gapPt / textSize]];
  return {
    textField: ['get', 'name'],
    textFont: MAP_LABEL_FONT,
    textSize,
    textColor: colors['map-label-text'],
    textAnchor: 'top',
    // Just below the scaled symbol (half its height ≈ 13 pt), or just below a pin's tip.
    textOffset: [
      'match',
      ['get', 'sidc'],
      PIN_POINT_SIDCS,
      below(PIN_LABEL_GAP_PT),
      [sidcForPointType('observation-post'), sidcForPointType('forward-observer-position')],
      below(OP_LABEL_GAP_PT),
      // Hostile units: 2525C SH…, or a 2525D 20-digit land unit with hostile identity (1006…).
      [
        'case',
        ['any', ['==', ['slice', ['get', 'sidc'], 0, 2], 'SH'], ['==', ['slice', ['get', 'sidc'], 0, 4], '1006']],
        below(HOSTILE_UNIT_LABEL_GAP_PT),
        below(POINT_LABEL_GAP_PT),
      ],
    ] as SymbolLayerStyle['textOffset'],
    iconImage: MAP_IMAGE_IDS.labelChip,
    iconTextFit: 'both',
    iconTextFitPadding: POINT_CHIP_PADDING,
  };
}

export const SELF_STYLE: SymbolLayerStyle = {
  iconImage: ['get', 'icon'],
  iconRotate: ['get', 'heading'],
  iconRotationAlignment: 'map',
  iconPitchAlignment: 'map',
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/**
 * Average mode's fixes (switched on from the fix count): a small orange dot for each fix and a faint ring of its accuracy
 * to true scale, with a dashed ring of the average's own ±. Orange marks Average mode; the rings are accuracy, so gray.
 */
export const AVERAGE_FIX_RING_OPACITY = 0.3;

export function makeAverageFixRingStyle(colors: Record<SemanticToken, string>): CircleLayerStyle {
  return {
    // A radius in meters: points at zoom 0, doubling with each zoom level.
    circleRadius: ['interpolate', ['exponential', 2], ['zoom'], 0, ['get', 'accuracyPt0'], 24, ['*', ['get', 'accuracyPt0'], 2 ** 24]] as CircleLayerStyle['circleRadius'],
    circleOpacity: 0,
    circleStrokeColor: colors['value-accuracy'],
    circleStrokeWidth: 1,
    circleStrokeOpacity: AVERAGE_FIX_RING_OPACITY,
    circlePitchAlignment: 'map',
  };
}

export function makeAverageFixDotStyle(colors: Record<SemanticToken, string>): CircleLayerStyle {
  return {
    circleRadius: 2.5,
    circleColor: colors.averaged,
    circleStrokeColor: colors['point-symbol-halo'],
    circleStrokeWidth: 0.75,
    circlePitchAlignment: 'map',
  };
}

export function makeAverageRingStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: colors['value-accuracy'], lineWidth: 1.5, lineDasharray: [3, 2] };
}

const role = (r: string) => ['==', ['get', 'role'], r];

/** Layer filters for the draft source's three feature roles. */
export const DRAFT_FILTERS = { draft: role('draft'), range: role('range'), rangeLabel: role('range-label') };

export const DRAFT_RING_STYLE: SymbolLayerStyle = {
  iconImage: MAP_IMAGE_IDS.draftRing,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

export const DRAFT_SYMBOL_STYLE: SymbolLayerStyle = {
  iconImage: ['get', 'sidc'],
  iconSize: ICON_SIZE_BY_CATEGORY,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/** Amber "HOS-4 · NEW" chip below the draft; always shown. */
export function makeDraftLabelStyle(colors: Record<SemanticToken, string>, textSize = LABEL_TEXT_SIZES.medium): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize,
    textColor: colors['on-accent'],
    textAnchor: 'top',
    textOffset: [0, DRAFT_LABEL_GAP_PT / textSize],
    iconImage: MAP_IMAGE_IDS.labelChipAccent,
    iconTextFit: 'both',
    iconTextFitPadding: LABEL_CHIP_PADDING,
    textAllowOverlap: true,
    iconAllowOverlap: true,
  };
}

/** A ring around the measure dot picked to move. */
export function makeMeasurePickedStyle(colors: Record<SemanticToken, string>): CircleLayerStyle {
  return { circleRadius: 11, circleOpacity: 0, circleStrokeColor: colors.accent, circleStrokeWidth: 2.5, circlePitchAlignment: 'map' };
}

/** Dashed amber range line from the user to the draft. */
export function makeRangeLineStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: colors.accent, lineWidth: 2, lineDasharray: [2, 2] };
}

/** A range chip's distance and bearing, apart, so each is drawn in its value color (see AGENTS.md, Value colors). */
export type RangeParts = { distance: string; bearing: string };

/**
 * A chip's text: with `distance` and `bearing` properties, "1.15 km · 103°" with each in its value color; otherwise its
 * `label` (a segment's length), in the distance color the style gives it.
 */
function rangeText(colors: Record<SemanticToken, string>): SymbolLayerStyle['textField'] {
  // A Mapbox `format` expression; the style types do not model its per-part options.
  const expression = [
    'case',
    ['has', 'bearing'],
    ['format', ['get', 'distance'], { 'text-color': colors['value-distance'] }, ' · ', { 'text-color': colors['map-label-text'] }, ['get', 'bearing'], { 'text-color': colors['value-bearing'] }],
    ['get', 'label'],
  ];
  return expression as unknown as SymbolLayerStyle['textField'];
}

/** "1.15 km · 103°" (or a segment's length) on a dark chip at the line's midpoint. */
export function makeRangeLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: rangeText(colors),
    textFont: MAP_LABEL_FONT,
    textSize: 12,
    textColor: colors['value-distance'],
    iconImage: MAP_IMAGE_IDS.labelChip,
    iconTextFit: 'both',
    iconTextFitPadding: LABEL_CHIP_PADDING,
    textAllowOverlap: true,
    iconAllowOverlap: true,
  };
}

/** Line widths in pt by width class; the halo is 2 pt wider. */
export const LINE_WIDTHS = { normal: 3, heavy: 5, wide: 7 } as const;
export const LINE_DASH = [2, 1.5];
const LINE_WIDTH: LineLayerStyle['lineWidth'] = ['match', ['get', 'width'], 'heavy', LINE_WIDTHS.heavy, 'wide', LINE_WIDTHS.wide, LINE_WIDTHS.normal];

export function makeLineHaloStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: colors['point-symbol-halo'], lineWidth: ['+', LINE_WIDTH, 2] as LineLayerStyle['lineWidth'], lineCap: 'round', lineJoin: 'round' };
}

export function makeLineStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: colors.friendly, lineWidth: LINE_WIDTH, lineCap: 'round', lineJoin: 'round' };
}

export function makeLineDashedStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { ...makeLineStyle(colors), lineCap: 'butt', lineDasharray: LINE_DASH };
}

/** Arrowhead at a line end, rotated to the end segment's bearing (map-aligned). */
export const LINE_ARROW_STYLE: SymbolLayerStyle = {
  iconImage: MAP_IMAGE_IDS.lineArrow,
  iconRotate: ['get', 'bearing'],
  iconRotationAlignment: 'map',
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/** FLOT bumps repeated along the line. */
export const LINE_FLOT_STYLE: SymbolLayerStyle = {
  symbolPlacement: 'line',
  symbolSpacing: 18,
  iconImage: MAP_IMAGE_IDS.lineFlotArc,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/** Interpolation stops for a vector that depends on a bearing, one every 15°; straight lines between them stay within 1%. */
function byBearing(bearing: unknown, vector: (radians: number) => [number, number]): unknown {
  const stops: unknown[] = [];
  for (let deg = 0; deg <= 360; deg += 15) stops.push(deg, ['literal', vector((deg * Math.PI) / 180)]);
  return ['interpolate', ['linear'], bearing, ...stops];
}

/**
 * "PL RED" chips at both ends of a line, just past the end and turned to follow its end segment.
 * `bearing` is the segment's outward direction; text never reads upside down, so an end pointing left
 * on screen (given the map's own `mapBearing`) is turned half around and reads toward the end instead.
 *
 * Mapbox moves rotated text by its offset without turning the offset, but turns the chip's offset with
 * the chip. So the text offset already points along the line, and the icon offset takes the chip back
 * from there to the same spot.
 */
export function makeLineLabelStyle(colors: Record<SemanticToken, string>, textSize = LABEL_TEXT_SIZES.medium, mapBearing = 0): SymbolLayerStyle {
  const gap = LINE_LABEL_GAP_PT;
  const bearing = ['%', ['+', ['get', 'bearing'], 360], 360];
  // The end's direction on screen, 0–360 clockwise from up: below 180 it points right.
  const pointsRight: unknown = ['<', ['%', ['+', ['get', 'bearing'], 720 - mapBearing], 360], 180];
  const rotate: unknown = ['case', pointsRight, ['-', ['get', 'bearing'], 90], ['+', ['get', 'bearing'], 90]];
  // `gap` pt past the end along the bearing, in the map's frame (x right, y down), in ems.
  const textOffset = byBearing(bearing, (b) => [(gap * Math.sin(b)) / textSize, (-gap * Math.cos(b)) / textSize]);
  // In the chip's turned frame the gap is straight ahead (or behind, when flipped); the text offset is already applied.
  const iconOffset = (side: 1 | -1) => byBearing(bearing, (b) => [side * gap - gap * Math.sin(b), gap * Math.cos(b)]);
  return {
    ...makePointLabelStyle(colors, textSize),
    textField: ['get', 'label'],
    textRotationAlignment: 'map',
    textRotate: rotate as SymbolLayerStyle['textRotate'],
    textAnchor: ['case', pointsRight, 'left', 'right'] as SymbolLayerStyle['textAnchor'],
    textOffset: textOffset as SymbolLayerStyle['textOffset'],
    iconImage: MAP_IMAGE_IDS.labelChipSquare,
    iconTextFitPadding: LABEL_CHIP_PADDING,
    iconRotationAlignment: 'map',
    iconRotate: rotate as SymbolLayerStyle['iconRotate'],
    iconOffset: ['case', pointsRight, iconOffset(1), iconOffset(-1)] as SymbolLayerStyle['iconOffset'],
  };
}

/** Measure readout chip at the line's midpoint: on a dark chip, so its distance and bearing show in their value colors. */
export function makeMeasureChipStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: rangeText(colors),
    textFont: MAP_LABEL_FONT,
    textSize: 13,
    textColor: colors['value-distance'],
    iconImage: MAP_IMAGE_IDS.labelChip,
    iconTextFit: 'both',
    iconTextFitPadding: LABEL_CHIP_PADDING,
    textAllowOverlap: true,
    iconAllowOverlap: true,
  };
}

/** Fill opacity of a polygon feature without an `opacity` property (the default, light fill). */
export const POLYGON_FILL_OPACITY = 0.15;

/** A polygon's color from its `color` property (its type's): hostile red, otherwise friendly blue. */
function polygonColor(colors: Record<SemanticToken, string>): unknown {
  return ['match', ['get', 'color'], 'hostile', colors.hostile, colors.friendly];
}

export function makePolygonFillStyle(colors: Record<SemanticToken, string>): FillLayerStyle {
  return {
    fillColor: polygonColor(colors) as FillLayerStyle['fillColor'],
    // Each polygon's own fill (its menu's Fill setting).
    fillOpacity: ['coalesce', ['get', 'opacity'], POLYGON_FILL_OPACITY] as FillLayerStyle['fillOpacity'],
  };
}

/** Tint inside a unit's range ring; light enough that the imagery reads through it. */
export const RING_FILL_OPACITY = 0.12;

function ringColor(colors: Record<SemanticToken, string>): unknown {
  return ['match', ['get', 'affiliation'], 'friendly', colors.friendly, 'hostile', colors.hostile, 'neutral', colors.neutral, colors.unknown];
}

export function makeRingFillStyle(colors: Record<SemanticToken, string>): FillLayerStyle {
  return { fillColor: ringColor(colors) as FillLayerStyle['fillColor'], fillOpacity: RING_FILL_OPACITY };
}

export function makeRingHaloStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: colors['point-symbol-halo'], lineWidth: 4 };
}

export function makeRingLineStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: ringColor(colors) as LineLayerStyle['lineColor'], lineWidth: 2 };
}

/**
 * The tappable copy of a ring's outline: drawn but all but invisible (a fully transparent line may not be hit-tested).
 * The source's tap box, not this width, sets how close to the border a tap must land.
 */
export function makeRingHitStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { ...makeRingLineStyle(colors), lineOpacity: 0.01 };
}

/** Polygon outlines: drawn like lines, in the polygon's color. */
export function makePolygonOutlineStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { ...makeLineStyle(colors), lineColor: polygonColor(colors) as LineLayerStyle['lineColor'] };
}

export function makePolygonOutlineDashedStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { ...makeLineDashedStyle(colors), lineColor: polygonColor(colors) as LineLayerStyle['lineColor'] };
}

/** "OBJ IRON" chip centered in the polygon. */
export function makePolygonLabelStyle(colors: Record<SemanticToken, string>, textSize = LABEL_TEXT_SIZES.medium): SymbolLayerStyle {
  return { ...makePointLabelStyle(colors, textSize), textField: ['get', 'label'], textAnchor: 'center', textOffset: [0, 0] };
}

/** Colors for the MGRS grid: its lines and labels (`line`), and the outline around both (`halo`). */
export type GridColors = { line: string; halo: string };

type GridLineLook = { width: number; opacity: number };
/** Grid line widths (pt) and opacities by strength (the Line strength setting), then by kind: grid zone edges, 100 km lines, then the finer lines. */
const GRID_LINE: Record<GridStrength, { zone: GridLineLook; major: GridLineLook; minor: GridLineLook }> = {
  light: { zone: { width: 1.6, opacity: 0.85 }, major: { width: 1.2, opacity: 0.7 }, minor: { width: 0.8, opacity: 0.5 } },
  medium: { zone: { width: 1.8, opacity: 1 }, major: { width: 1.4, opacity: 0.9 }, minor: { width: 1, opacity: 0.75 } },
  strong: { zone: { width: 2, opacity: 1 }, major: { width: 1.6, opacity: 1 }, minor: { width: 1.2, opacity: 1 } },
};
/** How much wider the outline is than its line: 0.6 pt each side. */
const GRID_CASING_EXTRA = 1.2;
/** The outline is a little fainter than its line, so it edges the line without reading as a second one. */
const GRID_CASING_OPACITY = 0.8;

/** A value by the line's kind, as a Mapbox `match` expression (usable for both width and opacity). */
function byGridKind(strength: GridStrength, pick: (k: GridLineLook) => number): number {
  const look = GRID_LINE[strength];
  const expression = ['match', ['get', 'kind'], 'zone', pick(look.zone), 'major', pick(look.major), pick(look.minor)];
  // The style types do not model expressions this way round; Mapbox takes them wherever a number goes.
  return expression as unknown as number;
}

/** MGRS grid lines: thin, firmer for 100 km lines and firmest for grid zone edges; bolder with `strength`. */
export function makeGridLineStyle(grid: GridColors, strength: GridStrength = 'light'): LineLayerStyle {
  return {
    lineColor: grid.line,
    lineWidth: byGridKind(strength, (k) => k.width),
    lineOpacity: byGridKind(strength, (k) => k.opacity),
  };
}

/**
 * The outline under each grid line, in the shade's outline color (dark under light shades, light under dark ones), like
 * the outline around the grid's numbers: it keeps the line readable over ground of its own color (sand, concrete, snow).
 */
export function makeGridCasingStyle(grid: GridColors, strength: GridStrength = 'light'): LineLayerStyle {
  return {
    lineColor: grid.halo,
    lineWidth: byGridKind(strength, (k) => k.width + GRID_CASING_EXTRA),
    lineOpacity: byGridKind(strength, (k) => k.opacity * GRID_CASING_OPACITY),
  };
}

/** MGRS grid numbers along the lines: small outlined text, no chip. `upright` false lets them follow the line's direction. */
export function makeGridLineLabelStyle(grid: GridColors, upright = true): SymbolLayerStyle {
  const style: SymbolLayerStyle = { ...makeGridAreaLabelStyle(grid), symbolPlacement: 'line', symbolSpacing: 250, textSize: 11 };
  return upright ? style : { ...style, textKeepUpright: false };
}

/**
 * Grid zone and 100 km square names, inside their areas. Zoomed all the way out a grid zone is barely wider than a
 * 13 pt name, so the names shrink there (to 9 pt) rather than collide and drop out; full size from zoom 3.
 */
export function makeGridAreaLabelStyle(grid: GridColors): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize: ['interpolate', ['linear'], ['zoom'], MIN_ZOOM, 9, 3, 13],
    textColor: grid.line,
    textHaloColor: grid.halo,
    textHaloWidth: 1.2,
  };
}
