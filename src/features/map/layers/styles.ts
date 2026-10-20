import type { FillLayerStyle, LineLayerStyle, SymbolLayerStyle } from '@rnmapbox/maps';

import { sidcForPointType } from '@/features/symbology/point-types';
import type { LabelSize } from '@/stores/settings';
import type { SemanticToken } from '@/theme/tokens';

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
const PIN_POINT_SIDCS = (['checkpoint', 'start-point', 'release-point', 'rally-point', 'linkup-point'] as const).map(sidcForPointType);
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
  return {
    textField: ['get', 'name'],
    textFont: MAP_LABEL_FONT,
    textSize,
    textColor: colors['map-label-text'],
    textAnchor: 'top',
    // Just below the scaled symbol (half its height ≈ 13 pt), or just below a pin's tip.
    textOffset: ['match', ['get', 'sidc'], PIN_POINT_SIDCS, ['literal', [0, PIN_LABEL_GAP_PT / textSize]], ['literal', [0, POINT_LABEL_GAP_PT / textSize]]],
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

/** Dashed amber range line from the user to the draft. */
export function makeRangeLineStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: colors.accent, lineWidth: 2, lineDasharray: [2, 2] };
}

/** "1.15 km · 103°" on a dark chip at the line's midpoint. */
export function makeRangeLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize: 12,
    textColor: colors.accent,
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

/** Measure readout chip: dark text on an amber chip at the line's midpoint. */
export function makeMeasureChipStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize: 13,
    textColor: colors['on-accent'],
    iconImage: MAP_IMAGE_IDS.labelChipAccent,
    iconTextFit: 'both',
    iconTextFitPadding: LABEL_CHIP_PADDING,
    textAllowOverlap: true,
    iconAllowOverlap: true,
  };
}

/** Light friendly-blue fill under polygon outlines. */
export const POLYGON_FILL_OPACITY = 0.15;

export function makePolygonFillStyle(colors: Record<SemanticToken, string>): FillLayerStyle {
  return { fillColor: colors.friendly, fillOpacity: POLYGON_FILL_OPACITY };
}

/** "OBJ IRON" chip centered in the polygon. */
export function makePolygonLabelStyle(colors: Record<SemanticToken, string>, textSize = LABEL_TEXT_SIZES.medium): SymbolLayerStyle {
  return { ...makePointLabelStyle(colors, textSize), textField: ['get', 'label'], textAnchor: 'center', textOffset: [0, 0] };
}
