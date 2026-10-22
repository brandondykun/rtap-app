import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Uppercase muted label above its content; `trailing` is a short note right-aligned on the label row. */
export function MenuSection({ label, trailing, children }: { label?: string; trailing?: string; children: ReactNode }) {
  return (
    <View testID={label ? `menu-section-${label}` : undefined} className="gap-2 px-4 pb-4">
      {label || trailing ? (
        <View className="flex-row items-baseline justify-between">
          {label ? <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</Text> : <View />}
          {trailing ? <Text className="font-mono text-sm text-text-muted">{trailing}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
