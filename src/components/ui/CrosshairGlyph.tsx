import { PixelRatio, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

// Proportions of the map crosshair at its full 38 pt size.
const FULL = 38;
const ARM = 14;
const THICKNESS = 1.5;
const DOT = 4;
/** The dark edge around an outlined crosshair, in device pixels: the thinnest there is, so the arms stay fine lines. */
const EDGE = 1;

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
  const halo = colors['point-symbol-halo'];
  // Laid out in whole device pixels and centred exactly: a line on a half pixel is rounded unevenly, which made one
  // side of its edge a pixel wider than the other.
  const scale = PixelRatio.get();
  const px = (pt: number) => Math.max(1, Math.round(pt * scale));
  const pt = (p: number) => p / scale;
  const k = size / FULL;
  const line = px(Math.max(1, THICKNESS * k));
  // The box is a pixel larger when that is what centres the line.
  const box = px(size) + ((px(size) - line) % 2);
  const arm = px(ARM * k);
  let dotSize = px(Math.max(2, DOT * k));
  dotSize += (box - dotSize) % 2;
  const edge = outline ? EDGE : 0;
  const mid = (box - line) / 2;

  // Each arm, with its edge drawn as a dark bar one pixel larger all round behind it.
  const bar = (vertical: boolean, end: 'top' | 'bottom' | 'left' | 'right') => {
    const shape = (pad: number) => ({
      position: 'absolute' as const,
      [vertical ? 'left' : 'top']: pt(mid - pad),
      [end]: pt(-pad),
      width: pt((vertical ? line : arm) + 2 * pad),
      height: pt((vertical ? arm : line) + 2 * pad),
    });
    return (
      <>
        {outline ? <View testID="crosshair-outline" style={{ ...shape(edge), backgroundColor: halo }} /> : null}
        <View testID="crosshair-arm" style={{ ...shape(0), backgroundColor: arms }} />
      </>
    );
  };
  const dotOuter = dotSize + 2 * edge;
  const dotAt = pt((box - dotOuter) / 2);
  return (
    <View testID="crosshair-glyph" style={{ width: pt(box), height: pt(box) }}>
      {bar(true, 'top')}
      {bar(true, 'bottom')}
      {bar(false, 'left')}
      {bar(false, 'right')}
      <View
        testID="crosshair-dot"
        style={{
          position: 'absolute',
          left: dotAt,
          top: dotAt,
          backgroundColor: dot,
          width: pt(dotOuter),
          height: pt(dotOuter),
          borderRadius: pt(dotOuter) / 2,
          ...(outline ? { borderWidth: pt(edge), borderColor: halo } : null),
        }}
      />
    </View>
  );
}
