import { Text, View, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** How far each dark copy sits from the text, in pt: a crisp edge one point wide all round. */
const EDGE = 1;
const SHIFTS = [-EDGE, 0, EDGE].flatMap((x) => [-EDGE, 0, EDGE].map((y) => [x, y] as const)).filter(([x, y]) => x !== 0 || y !== 0);

type Props = TextProps & { className?: string; color: string; children: string };

/**
 * Colored text with a crisp dark edge, so a light color still reads over snow without a backing behind it. React
 * Native cannot stroke text, so dark copies are drawn one point off in each of the eight directions under it; they
 * share its width and props, so they shrink to fit exactly as it does.
 */
export function OutlinedText({ color, style, children, testID, ...props }: Props) {
  const { colors } = useTheme();
  return (
    <View>
      {SHIFTS.map(([x, y]) => (
        <Text
          key={`${x},${y}`}
          testID="text-outline"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
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
