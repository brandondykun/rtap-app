import type { ReactNode } from 'react';
import { Text, View, type TextStyle } from 'react-native';

/** A grid card's leading icon and tag (CTR, ME); the tag is muted unless given a color. `tagStyle` adds to it (a glass outline). */
export function CardLead({ icon, tag, tagColor, tagStyle }: { icon: ReactNode; tag: string; tagColor?: string; tagStyle?: TextStyle }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {icon}
      <Text style={[tagColor ? { color: tagColor } : undefined, tagStyle]} className="font-mono-bold text-xs text-text-muted">
        {tag}
      </Text>
    </View>
  );
}
