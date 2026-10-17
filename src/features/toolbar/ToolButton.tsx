import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { icon: IconName; label: string; active?: boolean; onPress?: () => void };

/** Icon over an uppercase label (icon only when toolbar text is off in Settings). Active: amber on dark amber. No handler: disabled. */
export function ToolButton({ icon, label, active = false, onPress }: Props) {
  const { colors } = useTheme();
  const showText = useSettings((s) => s.showToolbarText);
  const disabled = !onPress;
  const color = active ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      // Icon only: a bigger icon in a taller pill, so the button and its active highlight keep their size.
      className={`min-w-12 items-center rounded-xl px-2 ${showText ? 'py-0.5' : 'py-1.5'} ${active ? 'bg-accent-subtle' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={showText ? 18 : 22} color={color} />
      {showText ? (
        <Text style={{ color }} className="text-[10px] font-semibold tracking-wider">
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
