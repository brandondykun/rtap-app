import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Uppercase muted label above its content. */
export function MenuSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View className="gap-2 px-4 pb-4">
      {label ? <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</Text> : null}
      {children}
    </View>
  );
}
