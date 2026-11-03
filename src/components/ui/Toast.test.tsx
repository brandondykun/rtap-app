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

  it('is a solid card, dark red edged in red for an error, its text light red', async () => {
    await renderWithProviders(<Toast top={100} />);
    await act(async () => useToast.getState().show('Saved.', 'info'));
    let card = screen.getByRole('alert').props.className as string;
    expect(card).toContain('bg-surface-raised');
    expect(card).not.toContain('surface-glass');
    expect(card).toContain('border-border');
    await act(async () => useToast.getState().show('Could not save.', 'error'));
    card = screen.getByRole('alert').props.className as string;
    expect(card).toContain('bg-danger-subtle');
    expect(card).toContain('border-danger');
    expect(screen.getByText('Could not save.').props.className).toContain('text-on-danger-subtle');
  });

  it('shows a quieter second line under the message when there is one', async () => {
    await renderWithProviders(<Toast top={100} />);
    await act(async () => useToast.getState().show('Name taken.', 'error', { detail: 'Choose a different name.' }));
    expect(screen.getByText('Name taken.')).toBeTruthy();
    expect(screen.getByText('Choose a different name.').props.className).toContain('text-xs');
    await act(async () => useToast.getState().show('Saved.', 'info'));
    expect(screen.queryByText('Choose a different name.')).toBeNull();
  });

  it('keeps a sticky toast until its close button is pressed; tapping the message does nothing', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<Toast top={0} />);
    await act(async () => useToast.getState().show('Stay', 'info', { sticky: true }));
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS * 3));
    await fireEvent.press(screen.getByText('Stay'));
    expect(screen.getByText('Stay')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Stay')).toBeNull();
  });
});
