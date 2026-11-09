import type { ReactNode } from 'react';
import { Text, View, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { OUTLINE_HIDDEN, outlineShifts } from './outline';

type Props = TextProps & { className?: string; color: string; children: ReactNode };

/**
 * Text with a crisp dark edge one device pixel wide, so it reads over snow without a backing behind it. The dark
 * copies under it share its width and props, so they shrink to fit exactly as it does.
 */
export function OutlinedText({ color, style, children, testID, ...props }: Props) {
  const { colors } = useTheme();
  return (
    <View>
      {outlineShifts().map(([x, y]) => (
        <Text
          key={`${x},${y}`}
          testID="text-outline"
          {...OUTLINE_HIDDEN}
          {...props}
          style={[style, { position: 'absolute', left: 0, right: 0, top: 0, color: colors['point-symbol-halo'], transform: [{ translateX: x }, { translateY: y }] }]}>
          {children}
        </Text>
      ))}
      <Text testID={testID} {...props} style={[style, { color }]}>
        {children}
      </Text>
    </View>
  );
}
