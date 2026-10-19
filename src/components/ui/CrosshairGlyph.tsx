import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

// Proportions of the map crosshair at its full 38 pt size.
const FULL = 38;
const ARM = 14;
const THICKNESS = 1.5;
const DOT = 4;

type Props = {
  /** Width and height in pt; the arms, gap and dot scale with it. */
  size?: number;
  /** Arm color; the app's look is white (`colors.text`), the default. */
  color?: string;
  /** Center dot color; the app's look is amber (`colors.accent`), the default. */
  dotColor?: string;
};

/**
 * THE crosshair: use this everywhere the app draws or refers to the crosshair (the map center, CTR
 * buttons and readouts, guides), so they all read as the same thing. White arms with an amber center
 * dot by default; override colors only where amber would vanish (e.g. on an amber button).
 */
export function CrosshairGlyph({ size = FULL, color, dotColor }: Props) {
  const { colors } = useTheme();
  const arms = color ?? colors.text;
  const dot = dotColor ?? colors.accent;
  const k = size / FULL;
  const arm = ARM * k;
  const thickness = Math.max(1, THICKNESS * k);
  const dotSize = Math.max(2, DOT * k);
  return (
    <View testID="crosshair-glyph" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View testID="crosshair-arm" style={{ position: 'absolute', backgroundColor: arms, width: thickness, height: arm, top: 0 }} />
      <View testID="crosshair-arm" style={{ position: 'absolute', backgroundColor: arms, width: thickness, height: arm, bottom: 0 }} />
      <View testID="crosshair-arm" style={{ position: 'absolute', backgroundColor: arms, height: thickness, width: arm, left: 0 }} />
      <View testID="crosshair-arm" style={{ position: 'absolute', backgroundColor: arms, height: thickness, width: arm, right: 0 }} />
      <View testID="crosshair-dot" style={{ backgroundColor: dot, width: dotSize, height: dotSize, borderRadius: dotSize / 2 }} />
    </View>
  );
}
