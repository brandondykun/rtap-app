import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { PlaceBar } from './PlaceBar';

describe('PlaceBar', () => {
  it('says Tap map, and Add at center / Cancel call back', async () => {
    const onAtCenter = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(<PlaceBar onAtCenter={onAtCenter} onCancel={onCancel} />);
    expect(screen.getByText('Tap map')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add at center'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onAtCenter).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
