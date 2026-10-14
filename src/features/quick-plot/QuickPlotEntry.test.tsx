import { fireEvent, screen, within } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { QuickPlotEntry } from './QuickPlotEntry';

const C = { lat: 38.9, lon: -77 };
const focusedLabels = () => (TextInput.prototype.focus as jest.Mock).mock.contexts.map((c) => (c as { props: { accessibilityLabel: string } }).props.accessibilityLabel);
const T = { lat: 38.91, lon: -77 };

beforeEach(() => {
  (TextInput.prototype.focus as jest.Mock).mockClear();
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  useQuickPlot.getState().open();
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('QuickPlotEntry', () => {
  it('prefills zone and square from the crosshair, focuses Easting and plots only a valid grid', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    const g = mgrsFieldsFor(T);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue(g.zoneBand);
    expect(screen.getByLabelText('100 km square')).toHaveDisplayValue(g.square);
    expect(screen.getByLabelText('Easting')).toHaveDisplayValue('');
    expect(focusedLabels()).toEqual(['Easting']);
    expect(screen.getByLabelText('Plot')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Easting'), '253');
    await fireEvent.changeText(screen.getByLabelText('Northing'), '05');
    expect(screen.getByLabelText('Plot')).toBeDisabled();
    await fireEvent(screen.getByLabelText('Northing'), 'submitEditing');
    expect(useQuickPlot.getState().temp).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent(/^Valid$/);
    await fireEvent.press(screen.getByLabelText('Plot'));
    expect(useQuickPlot.getState().temp!.lat).toBeCloseTo(T.lat, 4);
    expect(useQuickPlot.getState().entryOpen).toBe(false);
  });

  it('shows range and bearing from me, and clears to Zone', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    usePresence.getState().setSelfPosition({ position: C, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<QuickPlotEntry landscape />);
    const g = mgrsFieldsFor(T);
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Valid · 1.11 km @ 000° TRUE from you');
    await fireEvent.press(screen.getByLabelText('Clear grid'));
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue('');
    expect(focusedLabels().at(-1)).toBe('MGRS zone');
  });

  it('opens empty on Zone when the crosshair has no position yet', async () => {
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue('');
    expect(focusedLabels()).toEqual(['MGRS zone']);
  });


  it('puts Plot beside the grid in landscape so the keyboard cannot cover it', async () => {
    await renderWithProviders(<QuickPlotEntry landscape />);
    expect(within(screen.getByTestId('quick-plot-row')).getByLabelText('Plot')).toBeTruthy();
  });


  it('has no keyboard Done bar: Plot is the only way to plot', async () => {
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    expect(screen.getByLabelText('Northing').props.returnKeyType).toBeUndefined();
    expect(screen.getByLabelText('Northing').props.onSubmitEditing).toBeUndefined();
  });
});
