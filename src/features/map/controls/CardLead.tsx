import type { ReactNode } from 'react';
import { Text, View, type TextStyle } from 'react-native';

import { OutlinedText } from '@/components/ui/OutlinedText';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { icon: ReactNode; tag: string; tagColor?: string; tagStyle?: TextStyle; outline?: boolean };

/**
 * A grid card's leading icon and tag (CTR, ME); the tag is muted unless given a color. `tagStyle` adds to it (a glass
 * outline); `outline` gives the tag a crisp dark edge as well (pass an outlined icon to match).
 */
export function CardLead({ icon, tag, tagColor, tagStyle, outline = false }: Props) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-1.5">
      {icon}
      {outline ? (
        <OutlinedText color={tagColor ?? colors['text-muted']} style={tagStyle} className="font-mono-bold text-xs">
          {tag}
        </OutlinedText>
      ) : (
        <Text style={[tagColor ? { color: tagColor } : undefined, tagStyle]} className="font-mono-bold text-xs text-text-muted">
          {tag}
        </Text>
      )}
    </View>
  );
}
