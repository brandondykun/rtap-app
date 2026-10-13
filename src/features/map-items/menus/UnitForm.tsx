import { useState } from 'react';
import { Image, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { TextField } from '@/components/ui/TextField';
import { AFFILIATIONS, composeSidc, UNIT_TYPES, type Affiliation, type UnitType } from '@/features/symbology/presets';
import { SYMBOL_IMAGES } from '@/features/symbology/symbol-images.generated';
import { useDraft, type DraftMode } from '@/stores/draft';

import { NAME_PREFIX } from '../naming';
import { LocationSection } from './form/LocationSection';
import { useAutoName } from './form/use-auto-name';

const AFFILIATION_LABELS: Record<Affiliation, string> = { friend: 'Friendly', hostile: 'Hostile', neutral: 'Neutral', unknown: 'Unknown' };
// Listed alphabetically in the dropdown.
const UNIT_OPTIONS = UNIT_TYPES.map((t) => ({ value: t.id, label: t.label })).sort((a, b) => a.label.localeCompare(b.label));

/** The Add/Edit unit form. It edits only the draft store; the menu decides when to write. */
export function UnitForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const name = useDraft((s) => s.name);
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const setAffiliation = useDraft((s) => s.setAffiliation);
  const setUnitType = useDraft((s) => s.setUnitType);
  const setName = useDraft((s) => s.setName);
  const setNotes = useDraft((s) => s.setNotes);
  const [showNotes, setShowNotes] = useState(notes !== '');
  useAutoName(missionId, mode, NAME_PREFIX[affiliation]);

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <LocationSection />
      <MenuSection label="Affiliation">
        <MenuSegmented<Affiliation>
          options={AFFILIATIONS.map((a) => ({
            value: a,
            label: AFFILIATION_LABELS[a],
            icon: <Image source={SYMBOL_IMAGES[composeSidc(a, 'unspecified')]} style={{ width: 30, height: 22 }} resizeMode="contain" />,
          }))}
          value={affiliation}
          onChange={setAffiliation}
          disabled={locked}
        />
      </MenuSection>
      <MenuSection label="Unit type">
        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            <MenuSelect<UnitType> label="Unit type" options={UNIT_OPTIONS} value={unitType} onChange={setUnitType} disabled={locked} />
          </View>
          <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        </View>
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" /> : null}
      </MenuSection>
    </View>
  );
}
