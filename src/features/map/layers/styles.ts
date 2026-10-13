import type { FillLayerStyle, LineLayerStyle, SymbolLayerStyle } from '@rnmapbox/maps';

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
/** Chip padding around label text, [top, right, bottom, left] in pt. */
const LABEL_CHIP_PADDING: [number, number, number, number] = [0, 2, 0, 2];

/** Symbol icons: every point always shows; collisions never hide a symbol. */
export const POINT_SYMBOL_STYLE: SymbolLayerStyle = {
  iconImage: ['get', 'sidc'],
  iconSize: ICON_SIZE_BY_CATEGORY,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/** Label chips below each symbol; labels may hide each other when crowded (never the symbols). */
export function makePointLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'name'],
    textFont: MAP_LABEL_FONT,
    textSize: 12,
    textColor: colors['map-label-text'],
    textAnchor: 'top',
    // Just below the scaled symbol (half its height ≈ 13 pt).
    textOffset: [0, 1.3],
    iconImage: MAP_IMAGE_IDS.labelChip,
    iconTextFit: 'both',
    iconTextFitPadding: LABEL_CHIP_PADDING,
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
export function makeDraftLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize: 12,
    textColor: colors['on-accent'],
    textAnchor: 'top',
    textOffset: [0, 3.3],
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

/** "PL RED" chips at both ends of a line, beside the end point. */
export function makeLineLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return { ...makePointLabelStyle(colors), textField: ['get', 'label'], textAnchor: 'left', textOffset: [0.9, 0] };
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
export function makePolygonLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return { ...makePointLabelStyle(colors), textField: ['get', 'label'], textAnchor: 'center', textOffset: [0, 0] };
}
