import type { TextStyle } from 'react-native';

/** A dark outline for text and icons on a see-through (glass) panel, so they stay readable over bright imagery. */
export function glassHalo(colors: { 'surface-chrome': string }): TextStyle {
  return { textShadowColor: colors['surface-chrome'], textShadowRadius: 3 };
}
