import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Uppercase muted label above its content; `trailing` is a short note right-aligned on the label row. `flush` drops the
 * side padding, for sections inside an `inset` MenuColumns (which supplies it once).
 */
export function MenuSection({ label, trailing, flush = false, children }: { label?: string; trailing?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <View testID={label ? `menu-section-${label}` : undefined} className={`gap-2 pb-4 ${flush ? '' : 'px-4'}`}>
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
