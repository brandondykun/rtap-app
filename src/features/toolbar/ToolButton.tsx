import { Pressable, Text } from 'react-native';

import { glassHalo } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TOOL_INSET } from '@/features/map/layout';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { useToolbarHeight } from './use-toolbar-height';

type Props = {
  icon: IconName;
  label: string;
  active?: boolean;
  /** An on/off toggle's state: reported to screen readers only (the icon shows it), never highlighted. */
  toggled?: boolean;
  onPress?: () => void;
};

/** Icon over an uppercase label (icon only when toolbar text is off in Settings). Active: amber on dark amber. No handler: disabled. */
export function ToolButton({ icon, label, active = false, toggled, onPress }: Props) {
  const { colors } = useTheme();
  const showText = useSettings((s) => s.showToolbarText);
  const disabled = !onPress;
  const color = active ? colors.accent : colors.text;
  const halo = glassHalo(colors);
  const height = useToolbarHeight() - 2 * TOOL_INSET;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: toggled ?? active, disabled }}
      disabled={disabled}
      onPress={onPress}
      // A fixed TOOL_INSET from the bar's top and bottom, so the highlight's corners are concentric with the bar's.
      style={{ height }}
      className={`min-w-12 items-center justify-center rounded-xl px-2 ${active ? 'bg-accent-subtle' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={showText ? 18 : 22} color={color} style={halo} />
      {showText ? (
        <Text style={[halo, { color }]} className="text-[9px] font-semibold tracking-wide">
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
