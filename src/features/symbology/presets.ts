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

/** 2525C SIDC: scheme S, affiliation, dimension G (ground), status P, function ID, 5 modifier chars. */
export function composeSidc(affiliation: Affiliation, unitType: UnitType): string {
  return `S${AFFILIATION_CODE[affiliation]}GP${UNIT_FUNCTIONS[unitType].functionId}-----`;
}

export function decomposeSidc(sidc: string): { affiliation: Affiliation; unitType: UnitType } | null {
  for (const affiliation of AFFILIATIONS) {
    for (const unitType of Object.keys(UNIT_FUNCTIONS) as UnitType[]) {
      if (composeSidc(affiliation, unitType) === sidc) return { affiliation, unitType };
    }
  }
  return null;
}

export const PRESET_SIDCS: readonly string[] = AFFILIATIONS.flatMap((a) =>
  UNIT_TYPES.map((t) => composeSidc(a, t.id)),
);

export const DEFAULT_SIDC = composeSidc('unknown', 'unspecified');
