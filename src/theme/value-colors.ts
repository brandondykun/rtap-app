import type { SemanticToken } from './tokens';

/** The kinds of value that each keep one color everywhere they show (see AGENTS.md, Value colors). */
export type ValueKind = 'distance' | 'bearing' | 'altitude' | 'accuracy';

/** Each kind's color token. */
export const VALUE_TOKEN: Record<ValueKind, SemanticToken> = {
  distance: 'value-distance',
  bearing: 'value-bearing',
  altitude: 'value-altitude',
  accuracy: 'value-accuracy',
};

/** Each kind's text class (written out in full, so Tailwind finds it). */
export const VALUE_TEXT_CLASS: Record<ValueKind, string> = {
  distance: 'text-value-distance',
  bearing: 'text-value-bearing',
  altitude: 'text-value-altitude',
  accuracy: 'text-value-accuracy',
};

/** A grid's color: the friendly blue for you and friendly units, plain text for everything else. */
export function gridTextClass(friendly: boolean): string {
  return friendly ? 'text-friendly' : 'text-text';
}

/** One line of the About page's color guide: a sample value in its color, what it is and where it shows. */
export type ValueColorGuide = { name: string; token: SemanticToken; sample: string; help: string };

/** What each value color means, for the About page (the same rule as AGENTS.md, Value colors). */
export const VALUE_COLOR_GUIDE: readonly ValueColorGuide[] = [
  { name: 'Friendly grid', token: 'friendly', sample: '18S UJ 23812 05625', help: 'Your position (ME) and friendly units: the same blue as friendly symbols.' },
  { name: 'Other grid', token: 'text', sample: '18S UJ 24000 06250', help: 'The crosshair (CTR), the OP, hostile, neutral and unknown units, points and shapes.' },
  { name: 'Distance', token: 'value-distance', sample: '653 m', help: 'Range to the crosshair or an item, measured lengths, line segments, radii and perimeters.' },
  { name: 'Direction', token: 'value-bearing', sample: '298°', help: 'Bearings, in degrees or mils, with their north reference.' },
  { name: 'Altitude', token: 'value-altitude', sample: 'ALT 104 m', help: 'ALT: your altitude, the OP\'s and units\' and points\' ground altitude, the OP eye height and ceilings.' },
  { name: 'Accuracy', token: 'value-accuracy', sample: '±3 m', help: 'How close your GPS fix is: quieter than the values themselves.' },
];
