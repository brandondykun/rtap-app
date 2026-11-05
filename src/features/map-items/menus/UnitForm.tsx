import { View } from 'react-native';

import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { TextField } from '@/components/ui/TextField';
import { AFFILIATION_LABELS, AFFILIATIONS, composeSidc, ECHELONS, UNIT_TYPES, type Affiliation, type Echelon, type UnitType } from '@/features/symbology/presets';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useDraft, type DraftMode } from '@/stores/draft';

import { NAME_PREFIX } from '../naming';
import { LocationSection } from './form/LocationSection';
import { NotesSection } from './form/NotesSection';
import { UnitRangesSection } from './form/UnitRangesSection';
import { useAutoName } from './form/use-auto-name';

// Listed alphabetically in the dropdown.
const UNIT_OPTIONS = UNIT_TYPES.map((t) => ({ value: t.id, label: t.label })).sort((a, b) => a.label.localeCompare(b.label));
// Kept in size order (team up to division), not alphabetical.
const ECHELON_OPTIONS = ECHELONS.map((e) => ({ value: e.id, label: e.label }));

/** The Add/Edit unit form. It edits only the draft store; the menu decides when to write. */
export function UnitForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const echelon = useDraft((s) => s.echelon);
  const name = useDraft((s) => s.name);
  const locked = useDraft((s) => s.locked);
  const setAffiliation = useDraft((s) => s.setAffiliation);
  const setUnitType = useDraft((s) => s.setUnitType);
  const setEchelon = useDraft((s) => s.setEchelon);
  const setName = useDraft((s) => s.setName);
  useAutoName(missionId, mode, NAME_PREFIX[affiliation]);

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono clearable editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <LocationSection />
      {/* Its own row: beside Name the four symbols were squeezed. */}
      <MenuSection label="Affiliation">
        <MenuSegmented<Affiliation>
          options={AFFILIATIONS.map((a) => ({
            value: a,
            label: AFFILIATION_LABELS[a],
            icon: <SymbolImage sidc={composeSidc(a, 'unspecified')} width={30} height={22} />,
          }))}
          value={affiliation}
          onChange={setAffiliation}
          disabled={locked}
        />
      </MenuSection>
      {/* Each on its own row: side by side, long type names were cut off. */}
      <MenuSection label="Unit type">
        <MenuSelect<UnitType> label="Unit type" options={UNIT_OPTIONS} value={unitType} onChange={setUnitType} disabled={locked} />
      </MenuSection>
      <MenuSection label="Echelon">
        <MenuSelect<Echelon> label="Echelon" options={ECHELON_OPTIONS} value={echelon} onChange={setEchelon} disabled={locked} />
      </MenuSection>
      <UnitRangesSection mode={mode} />
      <NotesSection />
    </View>
  );
}
