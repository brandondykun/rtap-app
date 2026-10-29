import { Text, View } from 'react-native';

import { MenuSection } from '@/components/menu/MenuSection';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { TextField } from '@/components/ui/TextField';
import { notifyError } from '@/features/feedback/feedback';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft, type DraftMode } from '@/stores/draft';

import { setItemShowRing } from '../../commands';
import { observeItem, observeRingItemIds, type MapItemSnapshot } from '../../repository';
import { rangeFieldsFor, rangeFieldsForSidc, ringRadiusM, type RangeField } from '../../unit-ranges';

const NO_IDS: string[] = [];
const LABELS: Record<RangeField, string> = { threatRangeM: 'Threat ring', horizontalRangeM: 'Horizontal range', verticalRangeFt: 'Vertical range' };
const UNITS: Record<RangeField, string> = { threatRangeM: 'm', horizontalRangeM: 'm', verticalRangeFt: 'ft' };

/** The unit's range fields (by unit type) and, once a ring distance is saved, the ring switch. */
export function UnitRangesSection({ mode }: { mode: DraftMode }) {
  const unitType = useDraft((s) => s.unitType);
  const locked = useDraft((s) => s.locked);
  const rangeText = useDraft((s) => s.rangeText);
  const fields = rangeFieldsFor(unitType);
  return (
    <>
      {fields.map((field) => (
        <MenuSection key={field} label={LABELS[field]}>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <TextField
                mono
                keyboardType="decimal-pad"
                editable={!locked}
                accessibilityLabel={LABELS[field]}
                value={rangeText[field]}
                onChangeText={(t) => useDraft.getState().setRangeText(field, t)}
              />
            </View>
            <Text className="text-base text-text-muted">{UNITS[field]}</Text>
          </View>
        </MenuSection>
      ))}
      {mode === 'edit' ? <RingSwitch fields={fields} /> : null}
    </>
  );
}

/** Shown only once the saved item has a ring distance; works while the form is locked. */
function RingSwitch({ fields }: { fields: readonly RangeField[] }) {
  const ctx = useCommandContext();
  const itemId = useDraft((s) => s.itemId);
  const item = useObservable<MapItemSnapshot | null>(() => observeItem(ctx.db, itemId ?? ''), null, [ctx, itemId]);
  const ringIds = useObservable(() => observeRingItemIds(ctx.db), NO_IDS, [ctx]);
  if (!itemId || !item || ringRadiusM(item) === null) return null;
  // The draft's unit type may no longer have the field that gives the saved item its ring.
  const savedField = rangeFieldsForSidc(item.sidc).find((f) => f !== 'verticalRangeFt');
  if (!savedField || !fields.includes(savedField)) return null;
  const setShow = (show: boolean) => {
    void setItemShowRing(ctx, itemId, show).then((result) => {
      if (!result.ok) notifyError('Could not change the ring.');
    });
  };
  return (
    <MenuSection>
      <MenuToggle label="Show ring on map" value={ringIds.includes(itemId)} onValueChange={setShow} />
    </MenuSection>
  );
}
