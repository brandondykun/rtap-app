import { View } from 'react-native';

import { MenuTileButton } from '@/components/menu/MenuTileButton';
import { useArmed } from '@/components/menu/use-armed';
import { notifyError } from '@/features/feedback/feedback';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';

import { setItemHidden, setItemShowRing } from '../../commands';
import { observeRingItemIds, type MapItemSnapshot } from '../../repository';
import { rangeFieldsForSidc, ringRadiusM } from '../../unit-ranges';

const NO_IDS: string[] = [];

/** Center / Hide / Ring / Delete tiles. Delete asks for a second tap, then hands off to `onDelete`. */
export function ItemActions({ item, hidden, noun, onDelete }: { item: MapItemSnapshot; hidden: boolean; noun: string; onDelete: () => void }) {
  const ctx = useCommandContext();
  const ringIds = useObservable(() => observeRingItemIds(ctx.db), NO_IDS, [ctx]);
  const { armed, arm, disarm } = useArmed();
  const hasRing = rangeFieldsForSidc(item.sidc).length > 0;
  const ringOn = ringIds.includes(item.id);
  return (
    <View className="flex-row gap-3">
      <MenuTileButton label="Center" icon="crosshairs-gps" onPress={() => useDraft.getState().focusItem()} />
      <MenuTileButton
        label={hidden ? 'Show' : 'Hide'}
        icon={hidden ? 'eye-outline' : 'eye-off-outline'}
        active={hidden}
        onPress={() => void setItemHidden(ctx, item.id, !hidden).then((r) => { if (!r.ok) notifyError('Could not change visibility.'); })}
      />
      {hasRing ? (
        <MenuTileButton
          label="Ring"
          icon="radar"
          active={ringOn}
          disabled={ringRadiusM(item) === null}
          onPress={() => void setItemShowRing(ctx, item.id, !ringOn).then((r) => { if (!r.ok) notifyError('Could not change the ring.'); })}
        />
      ) : null}
      <MenuTileButton
        label={armed ? 'Tap again' : 'Delete'}
        icon="trash-can-outline"
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
