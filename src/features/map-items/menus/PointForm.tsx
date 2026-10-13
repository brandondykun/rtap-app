import { useState } from 'react';
import { Image, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { TextField } from '@/components/ui/TextField';
import { POINT_TYPES, pointTypePrefix, type PointType } from '@/features/symbology/point-types';
import { symbolThumbnail } from '@/features/symbology/symbol-thumbnail';
import { useDraft, type DraftMode } from '@/stores/draft';

import { LocationSection } from './form/LocationSection';
import { useAutoName } from './form/use-auto-name';

const TYPE_OPTIONS = POINT_TYPES.map((t) => ({
  value: t.id,
  label: t.label,
  icon: <Image source={symbolThumbnail(t.sidc)} style={{ width: 32, height: 26 }} resizeMode="contain" />,
}));

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
        <TextField mono editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <LocationSection />
      <MenuSection label="Point type">
        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            <MenuSelect<PointType> label="Point type" options={TYPE_OPTIONS} value={pointType} onChange={setPointType} disabled={locked} />
          </View>
          <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        </View>
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" /> : null}
      </MenuSection>
    </View>
  );
}
