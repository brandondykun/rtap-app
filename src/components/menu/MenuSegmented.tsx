import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

/** One-of-N control. Options with an icon show only the icon; the label is their accessible name. */
export function MenuSegmented<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View className="flex-row gap-1 rounded-xl border border-border bg-surface-input p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center rounded-lg border-2 py-2 ${selected ? 'border-accent bg-accent-subtle' : 'border-surface-input'}`}>
            {option.icon ?? <Text className={`text-sm font-semibold ${selected ? 'text-accent' : 'text-text'}`}>{option.label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
