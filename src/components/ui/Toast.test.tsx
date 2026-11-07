import { act, fireEvent, screen } from '@testing-library/react-native';

import { EDGE } from '@/features/map/layout';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { Toast, TOAST_DURATION_MS } from './Toast';

beforeEach(() => useToast.setState({ toast: null }));
afterEach(() => jest.useRealTimers());

describe('Toast', () => {
  describe('Average mode\'s hold-still notice', () => {
    const show = () => act(async () => useToast.getState().show('Accuracy improves over a few minutes', 'average', { sticky: true, title: 'HOLD STILL' }));

    it('is a glass card edged in Average mode\'s orange, its title orange over the message, across the screen in portrait', async () => {
      await renderWithProviders(<Toast top={100} landscape={false} />);
      await show();
      const card = screen.getByTestId('toast-average');
      expect(card.props.className).toMatch(/\brounded-2xl\b.*\bbg-surface-glass\b/);
      expect(card).toHaveStyle({ borderLeftColor: themeColors('dark').averaged, marginLeft: EDGE, marginRight: EDGE });
      expect(card.props.className).toContain('self-stretch');
      expect(screen.getByText('HOLD STILL')).toHaveStyle({ color: themeColors('dark').averaged });
      expect(screen.getByText('Accuracy improves over a few minutes')).toBeTruthy();
      // Phone-vibrating icon, then a hairline before ✕.
      expect(screen.getByTestId('toast-average-divider')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
      expect(useToast.getState().toast).toBeNull();
    });

    it('reads on one line in landscape, the message after a dot, and only as wide as that line', async () => {
      await renderWithProviders(<Toast top={100} landscape />);
      await show();
      expect(screen.getByTestId('toast-average')).toHaveTextContent(/HOLD STILL · accuracy improves over a few minutes/);
      expect(screen.queryByText('Accuracy improves over a few minutes')).toBeNull();
      expect(screen.getByTestId('toast-average').props.className).not.toContain('self-stretch');
    });

    it('stays until dismissed', async () => {
      jest.useFakeTimers();
      await renderWithProviders(<Toast top={100} landscape={false} />);
      await show();
      await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS * 10));
      expect(screen.getByTestId('toast-average')).toBeTruthy();
    });
  });

  it('renders nothing without a toast', async () => {
    await renderWithProviders(<Toast top={100} landscape={false} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the message and hides itself after the duration', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<Toast top={100} landscape={false} />);
    await act(async () => useToast.getState().show('Could not add the point.'));
    expect(screen.getByText('Could not add the point.')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText('Could not add the point.')).toBeNull();
  });

  it('hides when tapped', async () => {
    await renderWithProviders(<Toast top={100} landscape={false} />);
    await act(async () => useToast.getState().show('Tap me', 'info'));
    await fireEvent.press(screen.getByText('Tap me'));
    expect(useToast.getState().toast).toBeNull();
  });

  it('is a solid card, dark red edged in red for an error, its text light red', async () => {
    await renderWithProviders(<Toast top={100} landscape={false} />);
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
    await renderWithProviders(<Toast top={100} landscape={false} />);
    await act(async () => useToast.getState().show('Name taken.', 'error', { detail: 'Choose a different name.' }));
    expect(screen.getByText('Name taken.')).toBeTruthy();
    expect(screen.getByText('Choose a different name.').props.className).toContain('text-xs');
    await act(async () => useToast.getState().show('Saved.', 'info'));
    expect(screen.queryByText('Choose a different name.')).toBeNull();
  });

  it('keeps a sticky toast until its close button is pressed; tapping the message does nothing', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<Toast top={0} landscape={false} />);
    await act(async () => useToast.getState().show('Stay', 'info', { sticky: true }));
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS * 3));
    await fireEvent.press(screen.getByText('Stay'));
    expect(screen.getByText('Stay')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Stay')).toBeNull();
  });
});
