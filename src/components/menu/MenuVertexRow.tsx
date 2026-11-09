import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { tightUnit } from '@/components/ui/unit-gap';
import { useTheme } from '@/theme/ThemeProvider';
import { VALUE_TEXT_CLASS, type ValueKind } from '@/theme/value-colors';

type Props = {
  number: number;
  title: string;
  detail: string;
  /** The detail is a value (the distance from the previous point): drawn in that kind's value color. */
  detailKind?: ValueKind;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Omit for a read-only list: no remove (×). */
  onRemove?: () => void;
  removeDisabled?: boolean;
  /** Shown on the selected row: the next added point goes right after this one. */
  onInsertAfter?: () => void;
  /** Points are being inserted after this one: the row says so, with a Done that ends it. */
  inserting?: boolean;
  onInsertDone?: () => void;
};

/** One point of a line: number badge, grid, distance from the previous point, remove (×). */
export function MenuVertexRow({ number, title, detail, detailKind, selected = false, disabled = false, onPress, onRemove, removeDisabled = false, onInsertAfter, inserting = false, onInsertDone }: Props) {
  const { colors } = useTheme();
  return (
    <View testID={`vertex-row-${number}`} className={`border-t border-border px-3 py-3 ${selected ? 'bg-accent-subtle' : ''}`}>
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Point ${number}, ${title}, ${detail}`}
          accessibilityHint={onRemove ? undefined : 'Centers the map on this point'}
          accessibilityState={{ selected, disabled }}
          disabled={disabled}
          onPress={onPress}
          className="active:opacity-60 flex-1 flex-row items-center gap-3">
          <View className={`h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-accent' : 'bg-text'}`}>
            <Text className="text-sm font-bold text-surface-input">{number}</Text>
          </View>
          <Text numberOfLines={1} className="shrink font-mono text-base text-text">
            {title}
          </Text>
          <Text className={`ml-auto font-mono text-sm ${detailKind ? VALUE_TEXT_CLASS[detailKind] : selected ? 'text-accent' : 'text-text-muted'}`}>{tightUnit(detail, 14)}</Text>
        </Pressable>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove point ${number}`}
            accessibilityState={{ disabled: disabled || removeDisabled }}
            disabled={disabled || removeDisabled}
            onPress={onRemove}
            hitSlop={8}
            className={`active:opacity-60 ${disabled || removeDisabled ? 'opacity-30' : ''}`}>
            <Icon name="close" size={20} color={colors['text-muted']} />
          </Pressable>
        ) : null}
      </View>
      {selected && inserting && !disabled ? (
        <View className="mt-2 flex-row items-center gap-2">
          <Icon name="plus" size={16} color={colors.accent} />
          <Text className="text-sm font-semibold text-accent">Inserting points</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Done inserting points" onPress={onInsertDone} hitSlop={8} className="active:opacity-60 ml-auto flex-row items-center gap-1">
            <Icon name="check" size={16} color={colors.text} />
            <Text className="text-sm font-semibold text-text">Done</Text>
          </Pressable>
        </View>
      ) : selected && onInsertAfter && !disabled ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Insert after point ${number}`} onPress={onInsertAfter} className="active:opacity-60 mt-2 flex-row items-center gap-2 self-start">
          <Icon name="plus" size={16} color={colors.accent} />
          <Text className="text-sm font-semibold text-accent">Insert after</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
