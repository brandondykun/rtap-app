import { isValidElement, type ReactElement } from 'react';

import { tightUnit, unitGap } from './unit-gap';

type Gap = ReactElement<{ style: { letterSpacing: number }; children: string }>;

describe('tightUnit', () => {
  it('narrows only the space between the number and its unit', () => {
    for (const [text, before, after] of [
      ['1234 m', '1234', 'm'],
      ['±5 ft', '±5', 'ft'],
      ['6400 mils', '6400', 'mils'],
      ['+1.24 km', '+1.24', 'km'],
      ['ALT 300 ft', 'ALT 300', 'ft'],
      ['↔ 500 m', '↔ 500', 'm'],
    ]) {
      const parts = tightUnit(text, 12) as [string, Gap, string];
      expect(parts[0]).toBe(before);
      expect(isValidElement(parts[1])).toBe(true);
      expect(parts[1].props.children).toBe(' ');
      expect(parts[2]).toBe(after);
    }
  });

  it('leaves a value with no unit after a space as it is', () => {
    for (const text of ['045°', '—', 'start', 'ALT —']) expect(tightUnit(text, 12)).toBe(text);
  });
});

describe('unitGap', () => {
  it('cuts the space by the same share of a character at every text size', () => {
    const spacing = (size: number) => (unitGap(size) as Gap).props.style.letterSpacing;
    expect(spacing(12)).toBeCloseTo(-3.6);
    expect(spacing(16) / 16).toBeCloseTo(spacing(12) / 12);
  });
});
