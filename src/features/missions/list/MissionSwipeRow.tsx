import { useRef, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  name: string;
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
  onOpenActions: (row: SwipeableMethods) => void;
  /** The card's own look. */
  className: string;
  /** Fill the parent's height (the landscape pinned card). */
  fill?: boolean;
  children: ReactNode;
};

/** A mission card that opens on tap and swipes left for Edit and Delete. */
export function MissionSwipeRow({ name, onPress, onRename, onDelete, onOpenActions, className, fill, children }: Props) {
  const row = useRef<SwipeableMethods>(null);
  const { colors } = useTheme();
  const grow: StyleProp<ViewStyle> = fill ? { flex: 1 } : undefined;
  return (
    <ReanimatedSwipeable
      ref={row}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={grow}
      childrenContainerStyle={grow}
      onSwipeableWillOpen={() => {
        if (row.current) onOpenActions(row.current);
      }}
      renderRightActions={() => (
        <View className="ml-2 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}`}
            onPress={onRename}
            className="w-20 items-center justify-center gap-1 rounded-2xl border border-border bg-surface-raised active:opacity-60">
            <Icon name="pencil-outline" size={20} color={colors.text} />
            <Text className="font-semibold text-text">Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${name}`}
            onPress={onDelete}
            className="w-20 items-center justify-center gap-1 rounded-2xl bg-danger active:opacity-60">
            <Icon name="trash-can-outline" size={20} color={colors.text} />
            <Text className="font-bold text-text">Delete</Text>
          </Pressable>
        </View>
      )}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        // Swiping is hard to find with VoiceOver, so Rename and Delete are also accessibility actions.
        accessibilityActions={[
          { name: 'rename', label: 'Rename' },
          { name: 'delete', label: 'Delete' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'rename') onRename();
          if (e.nativeEvent.actionName === 'delete') onDelete();
        }}
        onPress={onPress}
        style={grow}
        className={className}>
        {children}
      </Pressable>
    </ReanimatedSwipeable>
  );
}
