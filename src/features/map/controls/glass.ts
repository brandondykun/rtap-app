import type { TextStyle } from 'react-native';

/** A dark outline for text on a see-through (glass) readout, so it stays readable over bright imagery. */
export function glassHalo(colors: { 'surface-chrome': string }): TextStyle {
  return { textShadowColor: colors['surface-chrome'], textShadowRadius: 3 };
}
