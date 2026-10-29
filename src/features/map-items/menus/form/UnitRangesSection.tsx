import { Switch, Text, View } from 'react-native';

import { MenuColumns } from '@/components/menu/MenuColumns';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { notifyError } from '@/features/feedback/feedback';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { UNIT_TYPES } from '@/features/symbology/presets';
import { useDraft, type DraftMode } from '@/stores/draft';
import { useTheme } from '@/theme/ThemeProvider';

import { setItemShowRing } from '../../commands';
import { observeItem, observeRingItemIds, type MapItemSnapshot } from '../../repository';
import { rangeFieldsFor, rangeFieldsForSidc, ringRadiusM, type RangeField } from '../../unit-ranges';

const NO_IDS: string[] = [];
const LABELS: Record<RangeField, string> = { threatRangeM: 'Threat range', horizontalRangeM: 'Horizontal', verticalRangeFt: 'Vertical (ceiling)' };
const UNITS: Record<RangeField, string> = { threatRangeM: 'm', horizontalRangeM: 'm', verticalRangeFt: 'ft' };

/** The unit's range fields (by unit type) in one THREAT RING box with, once a ring distance is saved, the ring switch; a slim note for types without a ring. */
export function UnitRangesSection({ mode }: { mode: DraftMode }) {
  const { colors } = useTheme();
  const unitType = useDraft((s) => s.unitType);
  const locked = useDraft((s) => s.locked);
  const rangeText = useDraft((s) => s.rangeText);
  const fields = rangeFieldsFor(unitType);
  if (fields.length === 0) {
    const label = UNIT_TYPES.find((t) => t.id === unitType)?.label;
    return (
      <View className="px-4 pb-4">
        <View testID="no-ring" className="rounded-lg border border-border px-3 py-2">
          <Text className="text-sm text-text-muted">{unitType === 'unspecified' || !label ? 'No threat ring for this unit type' : `No threat ring for ${label} units`}</Text>
        </View>
      </View>
    );
  }
  const input = (field: RangeField) => (
    <View className="flex-row items-center gap-2">
      <View className="flex-1">
        <TextField
          mono
          nested
          keyboardType="decimal-pad"
          editable={!locked}
          accessibilityLabel={LABELS[field]}
          value={rangeText[field]}
          onChangeText={(t) => useDraft.getState().setRangeText(field, t)}
        />
      </View>
      <Text className="text-base text-text-muted">{UNITS[field]}</Text>
    </View>
  );
  return (
    <View className="px-4 pb-4">
      <View testID="ring-box" className="gap-3 rounded-xl border border-border p-3">
        <View className="min-h-8 flex-row items-center gap-2">
          <Icon name="record-circle-outline" size={18} color={colors['text-muted']} />
          <Text className="flex-1 text-xs font-semibold uppercase tracking-widest text-text-muted">THREAT RING</Text>
          {mode === 'edit' ? <RingSwitch fields={fields} /> : null}
        </View>
        {fields.length === 1 ? (
          <View className="gap-1">
            <Text className="text-xs text-text-muted">{LABELS[fields[0]]}</Text>
            {input(fields[0])}
          </View>
        ) : (
          <MenuColumns>
            {fields.map((field) => (
              <View key={field} className="gap-1">
                <Text className="text-xs text-text-muted">{LABELS[field]}</Text>
                {input(field)}
              </View>
            ))}
          </MenuColumns>
        )}
      </View>
    </View>
  );
}

/** Shown only once the saved item has a ring distance; works while the form is locked. */
function RingSwitch({ fields }: { fields: readonly RangeField[] }) {
  const { colors } = useTheme();
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
    <View className="flex-row items-center gap-2">
      <Text className="text-sm text-text-muted">Show on map</Text>
      <Switch
        accessibilityLabel="Show on map"
        value={ringIds.includes(itemId)}
        onValueChange={setShow}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
