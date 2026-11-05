import { act, fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { MeasureBar } from './MeasureBar';

const C = { lat: 38.91, lon: -77 };

beforeEach(() => {
  useMeasure.setState(INITIAL_MEASURE);
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
  useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
  useMeasure.getState().startMeasure();
});

describe('MeasureBar', () => {
  it('asks for a start, then the end, setting each at the crosshair', async () => {
    await renderWithProviders(<MeasureBar />);
    expect(screen.getByText('Set start')).toBeTruthy();
    expect(screen.queryByLabelText('Restart')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Set at CTR'));
    expect(useMeasure.getState().start).toEqual(C);
    // No live end: the card asks for the end instead of measuring to the crosshair.
    expect(screen.getByText('Set end')).toBeTruthy();
  });

  it('has no From me button; once both are set asks for a point to edit, the readout left to the line; stops', async () => {
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    await renderWithProviders(<MeasureBar />);
    expect(screen.queryByLabelText('From me')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Set at CTR'));
    expect(screen.getByText('Tap point to edit')).toBeTruthy();
    expect(screen.getByTestId('measure-bar')).not.toHaveTextContent(/km|TRUE/);
    await fireEvent.press(screen.getByLabelText('Stop measuring'));
    expect(useMeasure.getState().active).toBe(false);
  });

  it('once both are set has no CTR until a point is picked; a picked point is asked for again and CTR moves it', async () => {
    const A = { lat: 38.9, lon: -77 };
    useMeasure.getState().place(A);
    useMeasure.getState().place(A);
    await renderWithProviders(<MeasureBar />);
    expect(screen.queryByLabelText('Set at CTR')).toBeNull();
    expect(screen.getByLabelText('Stop measuring')).toBeTruthy();
    await act(async () => useMeasure.getState().pick('start'));
    expect(screen.getByText('Set start')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Set at CTR'));
    expect(useMeasure.getState()).toMatchObject({ start: C, end: A, editing: null });
    expect(screen.getByText('Tap point to edit')).toBeTruthy();
    expect(screen.queryByLabelText('Set at CTR')).toBeNull();
  });

  it('looks like the other tap-mode bars: compact buttons, the crosshair with CTR', async () => {
    await renderWithProviders(<MeasureBar />);
    expect(screen.getByTestId('measure-bar')).toBeTruthy();
    expect(screen.getByLabelText('Set at CTR').props.className).toContain('min-h-10');
    expect(screen.getByLabelText('Set at CTR')).toHaveTextContent('CTR', { exact: true });
    expect(screen.getByLabelText('Stop measuring').props.className).toContain('min-h-10');
  });
});
