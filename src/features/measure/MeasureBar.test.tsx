import { fireEvent, screen } from '@testing-library/react-native';

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
  it('asks for a start, then sets points at the crosshair and shows the readout', async () => {
    await renderWithProviders(<MeasureBar />);
    expect(screen.getByText('Set start')).toBeTruthy();
    expect(screen.queryByLabelText('Restart')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Set at CTR'));
    expect(useMeasure.getState().start).toEqual(C);
    // No live end: the card asks for the end instead of measuring to the crosshair.
    expect(screen.getByText('Set end')).toBeTruthy();
  });

  it('has no From me button; measures and stops', async () => {
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    await renderWithProviders(<MeasureBar />);
    expect(screen.queryByLabelText('From me')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Set at CTR'));
    expect(screen.getByText('1.11 km · 000° TRUE')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Stop measuring'));
    expect(useMeasure.getState().active).toBe(false);
  });

  it('looks like the other tap-mode bars, with compact icon buttons', async () => {
    await renderWithProviders(<MeasureBar />);
    expect(screen.getByTestId('measure-bar')).toBeTruthy();
    expect(screen.getByLabelText('Set at CTR').props.className).toContain('min-h-10');
    expect(screen.queryByText('Set at CTR')).toBeNull();
    expect(screen.getByLabelText('Stop measuring').props.className).toContain('min-h-10');
  });
});
