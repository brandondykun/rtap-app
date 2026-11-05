export type Affiliation = 'friend' | 'hostile' | 'neutral' | 'unknown';
export const AFFILIATIONS: readonly Affiliation[] = ['friend', 'hostile', 'neutral', 'unknown'];
export const AFFILIATION_LABELS: Record<Affiliation, string> = { friend: 'Friendly', hostile: 'Hostile', neutral: 'Neutral', unknown: 'Unknown' };

export type UnitType =
  | 'unspecified'
  | 'infantry'
  | 'mechanized-infantry'
  | 'motorized-infantry'
  | 'light-infantry'
  | 'armor'
  | 'anti-armor'
  | 'recon'
  | 'medical'
  | 'engineer'
  | 'artillery'
  | 'mortar'
  | 'field-artillery-observer'
  | 'joint-fire-support'
  | 'sniper'
  | 'air-defense';

/**
 * Unit types with their 2525C ground-unit function IDs (6 chars), or for the few 2525C does not have, their 2525D land
 * unit entity (6 digits), which gives them a 2525D SIDC.
 */
const UNIT_FUNCTIONS: Record<UnitType, { label: string; functionId: string } | { label: string; entity: string }> = {
  unspecified: { label: 'Unspecified', functionId: 'U-----' },
  infantry: { label: 'Infantry', functionId: 'UCI---' },
  'mechanized-infantry': { label: 'Mechanized infantry', functionId: 'UCIZ--' },
  'motorized-infantry': { label: 'Motorized infantry', functionId: 'UCIM--' },
  'light-infantry': { label: 'Light infantry', functionId: 'UCIL--' },
  armor: { label: 'Armor', functionId: 'UCA---' },
  'anti-armor': { label: 'Anti-armor', functionId: 'UCAA--' },
  recon: { label: 'Reconnaissance', functionId: 'UCR---' },
  medical: { label: 'Medical', functionId: 'USM---' },
  engineer: { label: 'Engineer', functionId: 'UCE---' },
  artillery: { label: 'Artillery', functionId: 'UCF---' },
  mortar: { label: 'Mortar', functionId: 'UCFM--' },
  'field-artillery-observer': { label: 'Field artillery observer', entity: '130400' },
  'joint-fire-support': { label: 'Joint fire support', entity: '130500' },
  sniper: { label: 'Sniper', entity: '121500' },
  'air-defense': { label: 'Air defense', functionId: 'UCD---' },
};

export const UNIT_TYPES: readonly { id: UnitType; label: string }[] = (
  Object.keys(UNIT_FUNCTIONS) as UnitType[]
).map((id) => ({ id, label: UNIT_FUNCTIONS[id].label }));

const AFFILIATION_CODE: Record<Affiliation, string> = { friend: 'F', hostile: 'H', neutral: 'N', unknown: 'U' };
/** 2525D standard identity, SIDC position 4. */
const IDENTITY_CODE: Record<Affiliation, string> = { friend: '3', hostile: '6', neutral: '4', unknown: '1' };

export type Echelon =
  | 'unspecified'
  | 'team'
  | 'squad'
  | 'section'
  | 'platoon'
  | 'company'
  | 'battalion'
  | 'regiment'
  | 'brigade'
  | 'division'
  | 'corps'
  | 'army'
  | 'army-group'
  | 'region'
  | 'command';

/**
 * Echelon amplifiers, Team up to Command: 2525C SIDC positions 11-12 ("--" when unspecified) and the 2525D one
 * (positions 9-10, "00" when unspecified).
 */
export const ECHELONS: readonly { id: Echelon; label: string; code: string; dCode: string }[] = [
  { id: 'unspecified', label: 'Unspecified', code: '--', dCode: '00' },
  { id: 'team', label: 'Team', code: '-A', dCode: '11' },
  { id: 'squad', label: 'Squad', code: '-B', dCode: '12' },
  { id: 'section', label: 'Section', code: '-C', dCode: '13' },
  { id: 'platoon', label: 'Platoon', code: '-D', dCode: '14' },
  { id: 'company', label: 'Company', code: '-E', dCode: '15' },
  { id: 'battalion', label: 'Battalion', code: '-F', dCode: '16' },
  { id: 'regiment', label: 'Regiment', code: '-G', dCode: '17' },
  { id: 'brigade', label: 'Brigade', code: '-H', dCode: '18' },
  { id: 'division', label: 'Division', code: '-I', dCode: '21' },
  { id: 'corps', label: 'Corps/MEF', code: '-J', dCode: '22' },
  { id: 'army', label: 'Army', code: '-K', dCode: '23' },
  { id: 'army-group', label: 'Army Group/Front', code: '-L', dCode: '24' },
  { id: 'region', label: 'Region/Theater', code: '-M', dCode: '25' },
  { id: 'command', label: 'Command', code: '-N', dCode: '26' },
];

const ECHELON_BY_CODE = new Map(ECHELONS.map((e) => [e.code, e.id]));
const ECHELON_BY_D_CODE = new Map(ECHELONS.map((e) => [e.dCode, e.id]));
const AFFILIATION_BY_CODE = new Map(AFFILIATIONS.map((a) => [AFFILIATION_CODE[a], a]));
const AFFILIATION_BY_IDENTITY = new Map(AFFILIATIONS.map((a) => [IDENTITY_CODE[a], a]));
const UNIT_TYPE_BY_FUNCTION = new Map<string, UnitType>();
const UNIT_TYPE_BY_ENTITY = new Map<string, UnitType>();
for (const t of Object.keys(UNIT_FUNCTIONS) as UnitType[]) {
  const f = UNIT_FUNCTIONS[t];
  if ('entity' in f) UNIT_TYPE_BY_ENTITY.set(f.entity, t);
  else UNIT_TYPE_BY_FUNCTION.set(f.functionId, t);
}

/** A 2525D SIDC (20 digits) the app reads: version 10, reality context, a land unit (symbol set 10), present. */
function isLandUnitD(sidc: string): boolean {
  return /^\d{20}$/.test(sidc) && sidc.startsWith('10') && sidc.slice(4, 6) === '10' && sidc[6] === '0';
}

/**
 * 2525C SIDC: scheme S, affiliation, dimension G (ground), status P, function ID, echelon (11-12), then `---`. A type
 * 2525C does not have gets a 2525D one: version 10, context 0, identity, land unit 10, present, no HQ/TF/FD, echelon,
 * entity, no modifiers.
 */
export function composeSidc(affiliation: Affiliation, unitType: UnitType, echelon: Echelon = 'unspecified'): string {
  const f = UNIT_FUNCTIONS[unitType];
  const e = ECHELONS.find((x) => x.id === echelon)!;
  if ('entity' in f) return `100${IDENTITY_CODE[affiliation]}1000${e.dCode}${f.entity}0000`;
  return `S${AFFILIATION_CODE[affiliation]}GP${f.functionId}${e.code}---`;
}

/** A symbol's affiliation (2525C position 2, 2525D position 4), or null for one the app does not offer (suspect, exercise and so on). */
export function affiliationOf(sidc: string): Affiliation | null {
  if (/^\d{20}$/.test(sidc)) return AFFILIATION_BY_IDENTITY.get(sidc[3]) ?? null;
  return AFFILIATION_BY_CODE.get(sidc[1]) ?? null;
}

/** A ground unit SIDC the app can edit; an echelon it does not offer reads as unspecified. */
export function decomposeSidc(sidc: string): { affiliation: Affiliation; unitType: UnitType; echelon: Echelon } | null {
  if (isLandUnitD(sidc)) {
    const affiliation = AFFILIATION_BY_IDENTITY.get(sidc[3]);
    const unitType = UNIT_TYPE_BY_ENTITY.get(sidc.slice(10, 16));
    if (!affiliation || !unitType) return null;
    return { affiliation, unitType, echelon: ECHELON_BY_D_CODE.get(sidc.slice(8, 10)) ?? 'unspecified' };
  }
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
