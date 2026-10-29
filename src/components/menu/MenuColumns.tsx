import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

/** Lays its children out in equal-width columns. `inset` adds the menu's side padding once, around all the columns (pair it with `flush` MenuSections). */
export function MenuColumns({ inset = false, children }: { inset?: boolean; children: ReactNode }) {
  return (
    <View className={`flex-row gap-3 ${inset ? 'px-4' : ''}`}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} className="flex-1">
          {child}
        </View>
      ))}
    </View>
  );
}
