import type { TextStyle } from 'react-native';

/**
 * A dark outline for text on a see-through (glass) readout, so it stays readable over bright imagery. `undefined` when
 * the readout is solid, which needs none.
 */
export function glassHalo(glass: boolean, colors: { 'surface-chrome': string }): TextStyle | undefined {
  return glass ? { textShadowColor: colors['surface-chrome'], textShadowRadius: 3 } : undefined;
}
