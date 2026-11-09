import type { ReactNode } from 'react';
import { Text } from 'react-native';

/**
 * In the monospace font a space is a whole character wide; between a number and its unit (1234 m, ±5 ft, 6400 mils) it
 * is cut to half, so values take less width. Letter spacing is in points, so it is scaled to the text's size.
 */
const UNIT_GAP_EM = -0.3;

/** The narrowed space before a unit, for text of `fontSize` points (text-xs 12, text-sm 14, text-base 16). */
export function unitGap(fontSize: number): ReactNode {
  return (
    <Text key="unit-gap" style={{ letterSpacing: UNIT_GAP_EM * fontSize }}>
      {' '}
    </Text>
  );
}

/**
 * `text` with its number-to-unit space narrowed (see unitGap); the text itself is unchanged, so screen readers and text
 * queries still get `text`. Only for a value: a count ("5 fixes") would match too.
 */
export function tightUnit(text: string, fontSize: number): ReactNode {
  const match = /\d( )[a-zA-Z]/.exec(text);
  if (!match) return text;
  const space = match.index + 1;
  return [text.slice(0, space), unitGap(fontSize), text.slice(space + 1)];
}
