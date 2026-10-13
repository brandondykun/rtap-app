import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

/** Dropdown field that expands an inline list (no native picker), so it works inside the panel. */
export function MenuSelect<T extends string>({ label, options, value, onChange, disabled = false }: { label: string; options: Option<T>[]; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const currentOption = options.find((o) => o.value === value);
  const current = currentOption?.label ?? '';
  // No flex here: in a row the caller wraps it in flex-1; stacked, flex-1 would let it shrink to nothing.
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((o) => !o)}
        className="h-12 flex-row items-center justify-between rounded-xl border-2 border-border bg-surface-input px-3">
        <View className="shrink flex-row items-center gap-2">
          {currentOption?.icon ?? null}
          <Text numberOfLines={1} className="shrink text-lg text-text">
            {current}
          </Text>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors['text-muted']} />
      </Pressable>
      {open && !disabled ? (
        <View testID="menu-select-options" className="mt-1 overflow-hidden rounded-xl border border-border bg-surface-raised">
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="flex-row items-center justify-between px-3 py-3">
              <View className="flex-row items-center gap-2">
                {option.icon ?? null}
                <Text className="text-base text-text">{option.label}</Text>
              </View>
              {option.value === value ? <Icon name="check" size={18} color={colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
