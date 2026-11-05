import { View } from 'react-native';

import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { TextField } from '@/components/ui/TextField';
import { POINT_TYPES, pointTypePrefix, type PointType } from '@/features/symbology/point-types';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useDraft, type DraftMode } from '@/stores/draft';

import { LocationSection } from './form/LocationSection';
import { NotesSection } from './form/NotesSection';
import { useAutoName } from './form/use-auto-name';

// Listed alphabetically in the dropdown.
const TYPE_OPTIONS = POINT_TYPES.map((t) => ({
  value: t.id,
  label: t.label,
  keywords: t.prefix,
  icon: <SymbolImage sidc={t.sidc} width={32} height={26} />,
})).sort((a, b) => a.label.localeCompare(b.label));

/** Add/Edit point form: name and point type, location, notes. Edits only the draft store. */
export function PointForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const pointType = useDraft((s) => s.pointType);
  const name = useDraft((s) => s.name);
  const locked = useDraft((s) => s.locked);
  const setPointType = useDraft((s) => s.setPointType);
  const setName = useDraft((s) => s.setName);
  useAutoName(missionId, mode, pointTypePrefix(pointType));

  return (
    <View>
      {/* Each on its own row: side by side they were squeezed. */}
      <MenuSection label="Name">
        <TextField mono clearable editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <MenuSection label="Point type">
        <MenuSelect<PointType> label="Point type" options={TYPE_OPTIONS} value={pointType} onChange={setPointType} disabled={locked} />
      </MenuSection>
      <LocationSection />
      <NotesSection />
    </View>
  );
}
