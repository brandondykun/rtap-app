import { fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { MeasureCard } from './MeasureCard';

const C = { lat: 38.91, lon: -77 };

beforeEach(() => {
  useMeasure.setState(INITIAL_MEASURE);
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
  useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
  useMeasure.getState().startMeasure();
});

describe('MeasureCard', () => {
  it('asks for a start, then sets points at the crosshair and shows the readout', async () => {
    await renderWithProviders(<MeasureCard />);
    expect(screen.getByText('Measure')).toBeTruthy();
    expect(screen.getByText('Set start')).toBeTruthy();
    expect(screen.getByLabelText('From me')).toBeDisabled();
    expect(screen.getByLabelText('Restart')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Set at crosshair'));
    expect(useMeasure.getState().start).toEqual(C);
    // No live end: the card asks for the end instead of measuring to the crosshair.
    expect(screen.getByText('Set end')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Restart'));
    expect(useMeasure.getState().start).toBeNull();
  });

  it('measures from the user and stops', async () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<MeasureCard />);
    await fireEvent.press(screen.getByLabelText('From me'));
    expect(screen.getByText('Set end')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Set at crosshair'));
    expect(screen.getByText('1.11 km · 000° TRUE')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Stop measuring'));
    expect(useMeasure.getState().active).toBe(false);
  });


  it('wraps its buttons on narrow screens instead of spilling past the card', async () => {
    await renderWithProviders(<MeasureCard />);
    expect(screen.getByTestId('measure-buttons')).toHaveStyle({ flexWrap: 'wrap' });
  });
});
