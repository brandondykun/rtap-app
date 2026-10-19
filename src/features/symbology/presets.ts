export type Affiliation = 'friend' | 'hostile' | 'neutral' | 'unknown';
export const AFFILIATIONS: readonly Affiliation[] = ['friend', 'hostile', 'neutral', 'unknown'];

export type UnitType = 'unspecified' | 'infantry' | 'armor' | 'recon' | 'medical' | 'engineer' | 'artillery' | 'air-defense';

/** MVP unit types with their 2525C ground-unit function IDs (6 chars). */
const UNIT_FUNCTIONS: Record<UnitType, { label: string; functionId: string }> = {
  unspecified: { label: 'Unspecified', functionId: 'U-----' },
  infantry: { label: 'Infantry', functionId: 'UCI---' },
  armor: { label: 'Armor', functionId: 'UCA---' },
  recon: { label: 'Reconnaissance', functionId: 'UCR---' },
  medical: { label: 'Medical', functionId: 'USM---' },
  engineer: { label: 'Engineer', functionId: 'UCE---' },
  artillery: { label: 'Artillery', functionId: 'UCF---' },
  'air-defense': { label: 'Air defense', functionId: 'UCD---' },
};

export const UNIT_TYPES: readonly { id: UnitType; label: string }[] = (
  Object.keys(UNIT_FUNCTIONS) as UnitType[]
).map((id) => ({ id, label: UNIT_FUNCTIONS[id].label }));

const AFFILIATION_CODE: Record<Affiliation, string> = { friend: 'F', hostile: 'H', neutral: 'N', unknown: 'U' };

export type Echelon = 'unspecified' | 'team' | 'squad' | 'section' | 'platoon' | 'company' | 'battalion' | 'regiment' | 'brigade' | 'division';

/** 2525C echelon amplifier, SIDC positions 11-12 ("--" when unspecified), Team up to Division. */
export const ECHELONS: readonly { id: Echelon; label: string; code: string }[] = [
  { id: 'unspecified', label: 'Unspecified', code: '--' },
  { id: 'team', label: 'Team', code: '-A' },
  { id: 'squad', label: 'Squad', code: '-B' },
  { id: 'section', label: 'Section', code: '-C' },
  { id: 'platoon', label: 'Platoon', code: '-D' },
  { id: 'company', label: 'Company', code: '-E' },
  { id: 'battalion', label: 'Battalion', code: '-F' },
  { id: 'regiment', label: 'Regiment', code: '-G' },
  { id: 'brigade', label: 'Brigade', code: '-H' },
  { id: 'division', label: 'Division', code: '-I' },
];

const ECHELON_CODE = Object.fromEntries(ECHELONS.map((e) => [e.id, e.code])) as Record<Echelon, string>;
const ECHELON_BY_CODE = new Map(ECHELONS.map((e) => [e.code, e.id]));
const AFFILIATION_BY_CODE = new Map(AFFILIATIONS.map((a) => [AFFILIATION_CODE[a], a]));
const UNIT_TYPE_BY_FUNCTION = new Map((Object.keys(UNIT_FUNCTIONS) as UnitType[]).map((t) => [UNIT_FUNCTIONS[t].functionId, t]));

/** 2525C SIDC: scheme S, affiliation, dimension G (ground), status P, function ID, echelon (11-12), then `---`. */
export function composeSidc(affiliation: Affiliation, unitType: UnitType, echelon: Echelon = 'unspecified'): string {
  return `S${AFFILIATION_CODE[affiliation]}GP${UNIT_FUNCTIONS[unitType].functionId}${ECHELON_CODE[echelon]}---`;
}

/** A ground unit SIDC the app can edit; an echelon it does not offer reads as unspecified. */
export function decomposeSidc(sidc: string): { affiliation: Affiliation; unitType: UnitType; echelon: Echelon } | null {
  if (sidc.length !== 15 || sidc[0] !== 'S' || sidc[2] !== 'G' || sidc[3] !== 'P') return null;
  const affiliation = AFFILIATION_BY_CODE.get(sidc[1]);
  const unitType = UNIT_TYPE_BY_FUNCTION.get(sidc.slice(4, 10));
  if (!affiliation || !unitType) return null;
  return { affiliation, unitType, echelon: ECHELON_BY_CODE.get(sidc.slice(10, 12)) ?? 'unspecified' };
}

export const PRESET_SIDCS: readonly string[] = AFFILIATIONS.flatMap((a) =>
  UNIT_TYPES.map((t) => composeSidc(a, t.id)),
);

export const DEFAULT_SIDC = composeSidc('unknown', 'unspecified');
