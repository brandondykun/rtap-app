import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Option<T extends string> = { value: T; label: string };

/** Dropdown field that expands an inline list (no native picker), so it works inside the panel. */
export function MenuSelect<T extends string>({ label, options, value, onChange, disabled = false }: { label: string; options: Option<T>[]; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <View className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((o) => !o)}
        className="h-12 flex-row items-center justify-between rounded-xl border-2 border-border bg-surface-input px-3">
        <Text numberOfLines={1} className="shrink text-lg text-text">
          {current}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors['text-muted']} />
      </Pressable>
      {open && !disabled ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-border bg-surface-raised">
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
              <Text className="text-base text-text">{option.label}</Text>
              {option.value === value ? <Icon name="check" size={18} color={colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
