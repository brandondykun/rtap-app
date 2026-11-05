/** Control-measure point types (2525C tactical points), in the order the type selector shows them. */
export type PointType =
  | 'checkpoint'
  | 'observation-post'
  | 'landing-zone'
  | 'start-point'
  | 'release-point'
  | 'rally-point'
  | 'linkup-point'
  | 'target-reference-point'
  | 'target'
  | 'coordination-point'
  | 'decision-point'
  | 'waypoint'
  | 'casualty-collection-point'
  | 'combat-outpost'
  | 'forward-observer-position'
  | 'key-terrain';

/** The app's landing-zone code: milsymbol has no LZ point, so render/symbol-svg.ts draws it. */
export const LANDING_ZONE_SIDC = 'GFGPAAL-------X';
/** 2525C has no key terrain point: 2525D's code (control measure 132100). */
export const KEY_TERRAIN_SIDC = '10032500001321000000';

/**
 * A point type. `drawAs`: another SIDC whose graphic the renderer draws for it (stand-in artwork). `ownColors`: drawn
 * in the standard's colors, not the app's one point color, where the color has meaning (key terrain is purple).
 */
export type PointTypeInfo = { id: PointType; label: string; prefix: string; sidc: string; drawAs?: string; ownColors?: boolean };

const TRP_SIDC = 'GFGPDPT-------X';

export const POINT_TYPES: readonly PointTypeInfo[] = [
  { id: 'checkpoint', label: 'Checkpoint', prefix: 'CP', sidc: 'GFGPGPPK------X' },
  { id: 'observation-post', label: 'Observation post', prefix: 'OP', sidc: 'GFGPDPO-------X' },
  { id: 'landing-zone', label: 'Landing zone', prefix: 'LZ', sidc: LANDING_ZONE_SIDC },
  { id: 'start-point', label: 'Start point', prefix: 'SP', sidc: 'GFGPGPPS------X' },
  { id: 'release-point', label: 'Release point', prefix: 'RP', sidc: 'GFGPGPPE------X' },
  { id: 'rally-point', label: 'Rally point', prefix: 'RLY', sidc: 'GFGPGPPR------X' },
  { id: 'linkup-point', label: 'Linkup point', prefix: 'LU', sidc: 'GFGPGPPL------X' },
  { id: 'target-reference-point', label: 'Target reference point', prefix: 'TRP', sidc: TRP_SIDC },
  // Artillery point target (2525C fire support). Drawn as the TRP until it gets its own graphic.
  { id: 'target', label: 'Target', prefix: 'TGT', sidc: 'GFFPPTS-------X', drawAs: TRP_SIDC },
  { id: 'coordination-point', label: 'Coordination point', prefix: 'CRD', sidc: 'GFGPGPPO------X' },
  { id: 'decision-point', label: 'Decision point', prefix: 'DP', sidc: 'GFGPGPPD------X' },
  { id: 'waypoint', label: 'Waypoint', prefix: 'WP', sidc: 'GFGPGPPW------X' },
  // 2525C combat service support point.
  { id: 'casualty-collection-point', label: 'Casualty collection point', prefix: 'CCP', sidc: 'GFSPPY--------X' },
  { id: 'combat-outpost', label: 'Combat outpost', prefix: 'COP', sidc: 'GFGPDPOC------X' },
  { id: 'forward-observer-position', label: 'Forward observer position', prefix: 'FO', sidc: 'GFGPDPOF------X' },
  { id: 'key-terrain', label: 'Key terrain', prefix: 'KT', sidc: KEY_TERRAIN_SIDC, ownColors: true },
];

export const POINT_SIDCS: readonly string[] = POINT_TYPES.map((t) => t.sidc);

const BY_ID = new Map(POINT_TYPES.map((t) => [t.id, t]));
const BY_SIDC = new Map(POINT_TYPES.map((t) => [t.sidc, t]));

export function pointTypeForSidc(sidc: string | null): PointType | null {
  return (sidc && BY_SIDC.get(sidc)?.id) || null;
}

export function sidcForPointType(type: PointType): string {
  return BY_ID.get(type)!.sidc;
}

/** The SIDC whose graphic is drawn for this type. */
export function drawSidcFor(type: PointTypeInfo): string {
  return type.drawAs ?? type.sidc;
}

export function pointTypePrefix(type: PointType): string {
  return BY_ID.get(type)!.prefix;
}
