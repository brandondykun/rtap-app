import { PixelRatio, Text, View, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** How far each dark copy sits from the text, in device pixels: the thinnest edge there is, like the map crosshair's. */
const EDGE = 1;
const DIRECTIONS = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => [x, y] as const)).filter(([x, y]) => x !== 0 || y !== 0);

type Props = TextProps & { className?: string; color: string; children: string };

/**
 * Colored text with a crisp dark edge, so a light color still reads over snow without a backing behind it. React
 * Native cannot stroke text, so dark copies are drawn one device pixel off in each of the eight directions under it; they
 * share its width and props, so they shrink to fit exactly as it does.
 */
export function OutlinedText({ color, style, children, testID, ...props }: Props) {
  const { colors } = useTheme();
  const shift = EDGE / PixelRatio.get();
  return (
    <View>
      {DIRECTIONS.map(([dx, dy]) => [dx * shift, dy * shift]).map(([x, y]) => (
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
