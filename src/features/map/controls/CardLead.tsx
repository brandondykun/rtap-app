import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** A grid card's leading icon and tag (CTR, ME); the tag is muted unless given a color. */
export function CardLead({ icon, tag, tagColor }: { icon: ReactNode; tag: string; tagColor?: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {icon}
      <Text style={tagColor ? { color: tagColor } : undefined} className="font-mono-bold text-xs text-text-muted">
        {tag}
      </Text>
    </View>
  );
}
