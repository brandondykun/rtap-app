import { act, fireEvent, screen } from '@testing-library/react-native';

import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { Toast, TOAST_DURATION_MS } from './Toast';

beforeEach(() => useToast.setState({ toast: null }));
afterEach(() => jest.useRealTimers());

describe('Toast', () => {
  it('renders nothing without a toast', async () => {
    await renderWithProviders(<Toast top={100} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the message and hides itself after the duration', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<Toast top={100} />);
    await act(async () => useToast.getState().show('Could not add the point.'));
    expect(screen.getByText('Could not add the point.')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText('Could not add the point.')).toBeNull();
  });

  it('hides when tapped', async () => {
    await renderWithProviders(<Toast top={100} />);
    await act(async () => useToast.getState().show('Tap me', 'info'));
    await fireEvent.press(screen.getByText('Tap me'));
    expect(useToast.getState().toast).toBeNull();
  });

  it('is see-through, keeping the red border only for errors, with outlined text', async () => {
    await renderWithProviders(<Toast top={100} />);
    await act(async () => useToast.getState().show('Saved.', 'info'));
    let card = screen.getByRole('alert').props.className as string;
    expect(card).toContain('bg-surface-glass');
    expect(card).not.toContain('border');
    expect(screen.getByText('Saved.')).toHaveStyle({ textShadowRadius: 3 });
    await act(async () => useToast.getState().show('Could not save.', 'error'));
    card = screen.getByRole('alert').props.className as string;
    expect(card).toContain('bg-surface-glass');
    expect(card).toContain('border-danger');
  });
});
