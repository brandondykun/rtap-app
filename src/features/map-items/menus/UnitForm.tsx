import { useState } from 'react';
import { View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { TextField } from '@/components/ui/TextField';
import { AFFILIATIONS, composeSidc, ECHELONS, UNIT_TYPES, type Affiliation, type Echelon, type UnitType } from '@/features/symbology/presets';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useDraft, type DraftMode } from '@/stores/draft';

import { NAME_PREFIX } from '../naming';
import { LocationSection } from './form/LocationSection';
import { useAutoName } from './form/use-auto-name';

const AFFILIATION_LABELS: Record<Affiliation, string> = { friend: 'Friendly', hostile: 'Hostile', neutral: 'Neutral', unknown: 'Unknown' };
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
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const setAffiliation = useDraft((s) => s.setAffiliation);
  const setUnitType = useDraft((s) => s.setUnitType);
  const setEchelon = useDraft((s) => s.setEchelon);
  const setName = useDraft((s) => s.setName);
  const setNotes = useDraft((s) => s.setNotes);
  const [showNotes, setShowNotes] = useState(notes !== '');
  useAutoName(missionId, mode, NAME_PREFIX[affiliation]);

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono clearable editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <LocationSection />
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
      <MenuSection label="Unit type">
        <MenuSelect<UnitType> label="Unit type" options={UNIT_OPTIONS} value={unitType} onChange={setUnitType} disabled={locked} />
      </MenuSection>
      <MenuSection label="Echelon">
        <MenuSelect<Echelon> label="Echelon" options={ECHELON_OPTIONS} value={echelon} onChange={setEchelon} disabled={locked} />
      </MenuSection>
      <MenuSection>
        <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" /> : null}
      </MenuSection>
    </View>
  );
}
