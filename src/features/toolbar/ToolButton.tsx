import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { icon: IconName; label: string; active?: boolean; onPress?: () => void };

/** Icon over an uppercase label. Active: amber on dark amber. No handler: disabled. */
export function ToolButton({ icon, label, active = false, onPress }: Props) {
  const { colors } = useTheme();
  const disabled = !onPress;
  const color = active ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-w-12 items-center rounded-xl px-2 py-0.5 ${active ? 'bg-accent-subtle' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={18} color={color} />
      <Text style={{ color }} className="text-[10px] font-semibold tracking-wider">
        {label}
      </Text>
    </Pressable>
  );
}
