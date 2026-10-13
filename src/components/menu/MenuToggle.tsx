import { Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function MenuToggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-base text-text">{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
