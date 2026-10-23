import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

// Proportions of the map crosshair at its full 38 pt size.
const FULL = 38;
const ARM = 14;
const THICKNESS = 1.5;
const DOT = 4;
/** The dark edge around an outlined crosshair: thin, so the arms still read as fine lines. */
const EDGE = 0.75;

type Props = {
  /** Width and height in pt; the arms, gap and dot scale with it. */
  size?: number;
  /** Arm color; the app's look is white (`colors.text`), the default. */
  color?: string;
  /** Center dot color; the app's look is amber (`colors.accent`), the default. */
  dotColor?: string;
  /** A thin dark edge around the arms and dot, so the crosshair reads over light ground (snow) as well as dark. */
  outline?: boolean;
};

/**
 * THE crosshair: use this everywhere the app draws or refers to the crosshair (the map center, CTR
 * buttons and readouts, guides), so they all read as the same thing. White arms with an amber center
 * dot by default; override colors only where amber would vanish (e.g. on an amber button).
 */
export function CrosshairGlyph({ size = FULL, color, dotColor, outline = false }: Props) {
  const { colors } = useTheme();
  const arms = color ?? colors.text;
  const dot = dotColor ?? colors.accent;
  const k = size / FULL;
  const arm = ARM * k;
  const thickness = Math.max(1, THICKNESS * k);
  const dotSize = Math.max(2, DOT * k);
  const edge = outline ? EDGE : 0;
  const halo = colors['point-symbol-halo'];
  // Each arm, with its edge drawn as a slightly larger dark bar behind it, centered on the same line.
  const bar = (along: 'vertical' | 'horizontal', end: 'top' | 'bottom' | 'left' | 'right') => {
    const vertical = along === 'vertical';
    const shape = (pad: number) => ({ position: 'absolute' as const, [end]: -pad, width: (vertical ? thickness : arm) + 2 * pad, height: (vertical ? arm : thickness) + 2 * pad });
    return (
      <>
        {outline ? <View testID="crosshair-outline" style={{ ...shape(edge), backgroundColor: halo }} /> : null}
        <View testID="crosshair-arm" style={{ ...shape(0), backgroundColor: arms }} />
      </>
    );
  };
  const dotOuter = dotSize + 2 * edge;
  return (
    <View testID="crosshair-glyph" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {bar('vertical', 'top')}
      {bar('vertical', 'bottom')}
      {bar('horizontal', 'left')}
      {bar('horizontal', 'right')}
      <View
        testID="crosshair-dot"
        style={{ backgroundColor: dot, width: dotOuter, height: dotOuter, borderRadius: dotOuter / 2, ...(outline ? { borderWidth: edge, borderColor: halo } : null) }}
      />
    </View>
  );
}
