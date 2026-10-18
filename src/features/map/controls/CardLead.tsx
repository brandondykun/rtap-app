import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** A grid card's leading icon and tag (CTR, ME). */
export function CardLead({ icon, tag }: { icon: ReactNode; tag: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {icon}
      <Text className="font-mono-bold text-xs text-text-muted">{tag}</Text>
    </View>
  );
}
