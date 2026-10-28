import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithProviders } from '@/test-utils/render';

import { MenuSegmented, SEGMENTED_BORDER, SEGMENTED_HIGHLIGHT_RADIUS, SEGMENTED_PAD, SEGMENTED_RADIUS, SLIDE, TEXT_COLOR_DELAY_MS } from './MenuSegmented';

describe('MenuSegmented', () => {
  it('greys out a disabled option and ignores presses on it, leaving the others working', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <MenuSegmented<'a' | 'b'>
        options={[
          { value: 'a', label: 'A', disabled: true },
          { value: 'b', label: 'B' },
        ]}
        value="b"
        onChange={onChange}
      />,
    );
    const a = screen.getByLabelText('A');
    expect(a.props.accessibilityState).toMatchObject({ disabled: true });
    expect(a.props.className).toContain('opacity-40');
    await fireEvent.press(a);
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  type V = 'a' | 'b' | 'c';
  const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
  const OPTIONS = [
    { value: 'a' as const, label: 'A' },
    { value: 'b' as const, label: 'B' },
    { value: 'c' as const, label: 'C' },
  ];
  function Picker({ start }: { start: V }) {
    const [value, setValue] = useState<V>(start);
    return <MenuSegmented<V> options={OPTIONS} value={value} onChange={setValue} />;
  }
  /** Mimics native layout: each option 100 pt wide with a 4 pt gap; positions count from the outer edge, so they include the 1 pt border and 4 pt padding. */
  const layOut = async () => {
    for (const [i, label] of ['A', 'B', 'C'].entries()) {
      await act(async () => fireEvent(screen.getByLabelText(label), 'layout', { nativeEvent: { layout: { x: 5 + i * 104, y: 5, width: 100, height: 40 } } }));
    }
  };
  const pillAt = () => {
    const style = flat(screen.getByTestId('segmented-highlight').props.style) as { transform: { translateX: number }[]; width: number };
    return { x: style.transform[0].translateX, width: style.width };
  };

  it('draws one highlight behind the options, under the selected one once laid out', async () => {
    await renderWithProviders(<Picker start="b" />);
    expect(screen.queryByTestId('segmented-highlight')).toBeNull();
    await layOut();
    expect(pillAt()).toEqual({ x: 108, width: 100 });
    expect(flat(screen.getByTestId('segmented-highlight').props.style)).toMatchObject({ top: 4, bottom: 4 });
    // The options draw no highlight of their own: the one shared highlight slides between them.
    for (const label of ['A', 'B', 'C']) expect(screen.getByLabelText(label).props.className).not.toContain('bg-accent-subtle');
  });

  it('moves the highlight under a newly selected option, which stays marked selected', async () => {
    await renderWithProviders(<Picker start="a" />);
    await layOut();
    expect(pillAt().x).toBe(4);
    await fireEvent.press(screen.getByLabelText('C'));
    expect(pillAt()).toEqual({ x: 212, width: 100 });
    expect(screen.getByLabelText('C').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('A').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('changes the label color a little after the highlight starts moving', async () => {
    await renderWithProviders(<Picker start="a" />);
    const style = Object.assign({}, ...[screen.getByText('B').props.style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
    expect(style).toMatchObject({ transitionProperty: 'color', transitionDelay: TEXT_COLOR_DELAY_MS });
    expect(TEXT_COLOR_DELAY_MS).toBeGreaterThan(0);
    expect(TEXT_COLOR_DELAY_MS).toBeLessThan(SLIDE.duration);
  });

  it('slides on a gentle spring that settles without overshoot', () => {
    expect(SLIDE).toMatchObject({ dampingRatio: 1 });
    expect(SLIDE.duration).toBeGreaterThan(200);
  });

  it('keeps the highlight evenly inset (as much above as below) with corners that read as concentric with the outside', async () => {
    await renderWithProviders(<Picker start="a" />);
    await layOut();
    const style = flat(screen.getByTestId('segmented-highlight').props.style);
    // Positioned inside the border: the padding alone above, below and to the side.
    expect(style).toMatchObject({ top: SEGMENTED_PAD, bottom: SEGMENTED_PAD });
    expect(pillAt().x).toBe(SEGMENTED_PAD);
    expect(style.height).toBeUndefined();
    // Outer corner less the border and padding is 7 pt, which reads too square under the 2 pt accent border: optically rounder.
    expect(style.borderRadius).toBe(SEGMENTED_HIGHLIGHT_RADIUS);
    expect(SEGMENTED_HIGHLIGHT_RADIUS).toBe(SEGMENTED_RADIUS - SEGMENTED_BORDER - SEGMENTED_PAD + 1);
    expect(flat(screen.getByTestId('segmented-control').props.style)).toMatchObject({ borderRadius: SEGMENTED_RADIUS, borderWidth: SEGMENTED_BORDER, padding: SEGMENTED_PAD });
  });
});
