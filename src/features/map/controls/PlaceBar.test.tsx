import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { PlaceBar } from './PlaceBar';

describe('PlaceBar', () => {
  it('names what is being added in portrait, and Add at center / Cancel call back', async () => {
    const onAtCenter = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(<PlaceBar category="unit" landscape={false} onAtCenter={onAtCenter} onCancel={onCancel} />);
    expect(screen.getByText('Tap map to add a unit')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add at center'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onAtCenter).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('just says Tap map in landscape', async () => {
    await renderWithProviders(<PlaceBar category="point" landscape onAtCenter={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Tap map')).toBeTruthy();
  });
});
