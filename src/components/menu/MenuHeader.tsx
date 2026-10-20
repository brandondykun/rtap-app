import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

export type MenuHeaderAction = { label: string; onPress: () => void; disabled?: boolean; icon?: IconName };

/** Leading outlined action (Cancel / Close / Back), centered uppercase title, trailing amber primary button. */
export function MenuHeader({ title, leading, trailing }: { title: string; leading?: MenuHeaderAction; trailing?: MenuHeaderAction }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center px-4 pb-3">
      <View className="min-w-20 items-start">
        {leading ? (
          <Pressable
            accessibilityRole="button"
            onPress={leading.onPress}
            hitSlop={8}
            className={`flex-row items-center rounded-xl border border-border bg-surface-raised py-2 active:opacity-60 ${leading.icon ? 'pl-2 pr-4' : 'px-4'}`}>
            {leading.icon ? <Icon name={leading.icon} size={18} color={colors.text} /> : null}
            <Text className="font-semibold text-text">{leading.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} className="flex-1 text-center text-base font-bold uppercase tracking-widest text-text">
        {title}
      </Text>
      <View className="min-w-20 items-end">
        {trailing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={trailing.label}
            accessibilityState={{ disabled: !!trailing.disabled }}
            disabled={trailing.disabled}
            onPress={trailing.onPress}
            className={`flex-row items-center gap-1 rounded-xl bg-accent px-4 py-2 ${trailing.disabled ? 'opacity-40' : ''}`}>
            {trailing.icon ? <Icon name={trailing.icon} size={18} color={colors['on-accent']} /> : null}
            <Text className="font-bold text-on-accent">{trailing.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
