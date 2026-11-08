import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { DevMenu } from './DevMenu';

describe('DevMenu', () => {
  it('is one small button until opened, then lists its actions', async () => {
    const run = jest.fn();
    await renderWithProviders(<DevMenu actions={[{ label: 'Seed 5k', icon: 'database-plus-outline', onPress: run }]} />);
    expect(screen.queryByRole('button', { name: 'Seed 5k' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Developer menu' }));
    expect(screen.getByRole('header', { name: 'Developer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seed 5k' })).toBeTruthy();
  });

  it('closes, then runs the chosen action', async () => {
    const run = jest.fn();
    await renderWithProviders(<DevMenu actions={[{ label: 'Landing', icon: 'rocket-launch-outline', onPress: run }]} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Developer menu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Landing' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dev-menu')).toBeNull();
  });

  it('closes from Close or a tap outside, running nothing', async () => {
    const run = jest.fn();
    await renderWithProviders(<DevMenu actions={[{ label: 'Landing', icon: 'rocket-launch-outline', onPress: run }]} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Developer menu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('dev-menu')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Developer menu' }));
    await fireEvent.press(screen.getByLabelText('Close developer menu', { includeHiddenElements: true }));
    expect(screen.queryByTestId('dev-menu')).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
});
