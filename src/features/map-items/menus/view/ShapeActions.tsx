import { View } from 'react-native';

import { MenuTileButton } from '@/components/menu/MenuTileButton';
import { useArmed } from '@/components/menu/use-armed';
import { notifyError } from '@/features/feedback/feedback';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

import { setItemHidden } from '../../commands';

/** Fit / Lengths (lines and points polygons) / Hide / Delete tiles for a line or polygon. Delete asks for a second tap, then hands off to `onDelete`. */
export function ShapeActions({ id, lengths, hidden, onDelete }: { id: string; lengths: boolean; hidden: boolean; onDelete: () => void }) {
  const ctx = useCommandContext();
  const showLengths = useSettings((s) => s.showLineDistances);
  const { armed, arm, disarm } = useArmed();
  return (
    <View className="flex-row gap-3">
      <MenuTileButton label="Fit" icon="fit-to-screen-outline" onPress={() => useDraft.getState().refocus()} />
      {lengths ? <MenuTileButton label="Lengths" accessibilityLabel="Show point distances" icon="vector-polyline" active={showLengths} onPress={() => useSettings.getState().setShowLineDistances(!showLengths)} /> : null}
      <MenuTileButton
        label={hidden ? 'Show' : 'Hide'}
        icon={hidden ? 'eye-outline' : 'eye-off-outline'}
        active={hidden}
        onPress={() => void setItemHidden(ctx, id, !hidden).then((r) => { if (!r.ok) notifyError('Could not change visibility.'); })}
      />
      <MenuTileButton
        label={armed ? 'Tap again' : 'Delete'}
        icon="trash-can-outline"
        accessibilityLabel={armed ? 'Tap again to delete' : undefined}
        tone="danger"
        active={armed}
        onPress={() => {
          if (!armed) return arm();
          disarm();
          onDelete();
        }}
      />
    </View>
  );
}
