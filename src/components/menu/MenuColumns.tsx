import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

/** Lays its children out in equal-width columns. */
export function MenuColumns({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-3">
      {Children.toArray(children).map((child, i) => (
        <View key={i} className="flex-1">
          {child}
        </View>
      ))}
    </View>
  );
}
