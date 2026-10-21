import { useState } from 'react';
import { View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { TextField } from '@/components/ui/TextField';
import { POINT_TYPES, pointTypePrefix, type PointType } from '@/features/symbology/point-types';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useDraft, type DraftMode } from '@/stores/draft';

import { LocationSection } from './form/LocationSection';
import { useAutoName } from './form/use-auto-name';

// Listed alphabetically in the dropdown.
const TYPE_OPTIONS = POINT_TYPES.map((t) => ({
  value: t.id,
  label: t.label,
  icon: <SymbolImage sidc={t.sidc} width={32} height={26} />,
})).sort((a, b) => a.label.localeCompare(b.label));

/** Add/Edit point form: location, point type, name, notes. Edits only the draft store. */
export function PointForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const pointType = useDraft((s) => s.pointType);
  const name = useDraft((s) => s.name);
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const setPointType = useDraft((s) => s.setPointType);
  const setName = useDraft((s) => s.setName);
  const setNotes = useDraft((s) => s.setNotes);
  const [showNotes, setShowNotes] = useState(notes !== '');
  useAutoName(missionId, mode, pointTypePrefix(pointType));

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono clearable editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <LocationSection />
      <MenuSection label="Point type">
        <MenuSelect<PointType> label="Point type" options={TYPE_OPTIONS} value={pointType} onChange={setPointType} disabled={locked} />
      </MenuSection>
      <MenuSection>
        <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" /> : null}
      </MenuSection>
    </View>
  );
}
