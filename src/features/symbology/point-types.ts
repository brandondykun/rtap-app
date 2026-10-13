/** Control-measure point types (2525C tactical points), in the order the type selector shows them. */
export type PointType =
  | 'checkpoint'
  | 'observation-post'
  | 'landing-zone'
  | 'start-point'
  | 'release-point'
  | 'rally-point'
  | 'linkup-point'
  | 'target-reference-point';

/** The app's landing-zone code: milsymbol has no LZ point, so scripts/build-symbols.ts draws it. */
export const LANDING_ZONE_SIDC = 'GFGPAAL-------X';

export const POINT_TYPES: readonly { id: PointType; label: string; prefix: string; sidc: string }[] = [
  { id: 'checkpoint', label: 'Checkpoint', prefix: 'CP', sidc: 'GFGPGPPK------X' },
  { id: 'observation-post', label: 'Observation post', prefix: 'OP', sidc: 'GFGPDPO-------X' },
  { id: 'landing-zone', label: 'Landing zone', prefix: 'LZ', sidc: LANDING_ZONE_SIDC },
  { id: 'start-point', label: 'Start point', prefix: 'SP', sidc: 'GFGPGPPS------X' },
  { id: 'release-point', label: 'Release point', prefix: 'RP', sidc: 'GFGPGPPE------X' },
  { id: 'rally-point', label: 'Rally point', prefix: 'RLY', sidc: 'GFGPGPPR------X' },
  { id: 'linkup-point', label: 'Linkup point', prefix: 'LU', sidc: 'GFGPGPPL------X' },
  { id: 'target-reference-point', label: 'Target reference point', prefix: 'TRP', sidc: 'GFGPDPT-------X' },
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

export function pointTypePrefix(type: PointType): string {
  return BY_ID.get(type)!.prefix;
}
