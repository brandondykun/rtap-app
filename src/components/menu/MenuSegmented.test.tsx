import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithProviders } from '@/test-utils/render';

import { MenuSegmented } from './MenuSegmented';

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
  const OPTIONS = [
    { value: 'a' as const, label: 'A' },
    { value: 'b' as const, label: 'B' },
    { value: 'c' as const, label: 'C' },
  ];
  function Picker({ start }: { start: V }) {
    const [value, setValue] = useState<V>(start);
    return <MenuSegmented<V> options={OPTIONS} value={value} onChange={setValue} />;
  }
  /** Mimics native layout: each option 100 pt wide with a 4 pt gap, inside 4 pt padding. */
  const layOut = async () => {
    for (const [i, label] of ['A', 'B', 'C'].entries()) {
      await act(async () => fireEvent(screen.getByLabelText(label), 'layout', { nativeEvent: { layout: { x: 4 + i * 104, y: 4, width: 100, height: 40 } } }));
    }
  };
  const pillAt = () => {
    const style = Object.assign({}, ...[screen.getByTestId('segmented-highlight').props.style].flat(Infinity).filter(Boolean)) as { transform: { translateX: number }[]; width: number };
    return { x: style.transform[0].translateX, width: style.width };
  };

  it('draws one highlight behind the options, under the selected one once laid out', async () => {
    await renderWithProviders(<Picker start="b" />);
    expect(screen.queryByTestId('segmented-highlight')).toBeNull();
    await layOut();
    expect(pillAt()).toEqual({ x: 108, width: 100 });
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
});
