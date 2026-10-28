import { fireEvent, screen } from '@testing-library/react-native';

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
});
