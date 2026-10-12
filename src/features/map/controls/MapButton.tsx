import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { CONTROL_SIZE } from '../layout';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  active?: boolean;
  disabled?: boolean;
  /** Bare button (no chrome) for use inside a grouped container. */
  grouped?: boolean;
  children?: ReactNode;
};

export function MapButton({ label, onPress, icon, active = false, disabled = false, grouped = false, children }: Props) {
  const { colors } = useTheme();
  const chrome = grouped ? '' : 'rounded-2xl border border-border bg-surface-chrome';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: CONTROL_SIZE, height: CONTROL_SIZE }}
      className={`items-center justify-center ${chrome} ${disabled ? 'opacity-40' : ''}`}>
      {icon ? <Icon name={icon} size={26} color={active ? colors.accent : colors.text} /> : children}
    </Pressable>
  );
}
