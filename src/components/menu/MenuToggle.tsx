import { Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function MenuToggle({ label, value, onValueChange, disabled = false }: { label: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-base text-text">{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
