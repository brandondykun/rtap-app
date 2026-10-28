import { act, fireEvent, screen } from '@testing-library/react-native';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MANUAL_ENTRY, useManualEntry } from '@/stores/manual-entry';
import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { ManualLocationEntry } from './ManualLocationEntry';

const DC = { lat: 38.8977, lon: -77.0365 };
const MESSAGE = 'Position set by hand. You can change it any time in Settings → Location.';
const setPressable = () => screen.getByLabelText('Set');

beforeEach(() => {
  useManualEntry.setState(INITIAL_MANUAL_ENTRY);
  useMyLocation.setState(DEFAULT_MY_LOCATION);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: DC, zoom: 14, bearing: 0 });
  useToast.setState({ toast: null });
});

describe('ManualLocationEntry', () => {
  it('renders only while the box is open (not while choosing)', async () => {
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    expect(screen.queryByText('MY POSITION')).toBeNull();
    await act(async () => useManualEntry.getState().open('map', null));
    expect(screen.getByText('MY POSITION')).toBeTruthy();
    await act(async () => useManualEntry.getState().startChoosing());
    expect(screen.queryByText('MY POSITION')).toBeNull();
  });

  it('reads Choose on map, then Adjust on map once a spot is chosen, with its grid filled in', async () => {
    useManualEntry.getState().open('map', null);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    expect(screen.getByText('Choose on map')).toBeTruthy();
    expect(screen.getByText('Type your grid, or choose your spot on the map.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Choose on map'));
    expect(useManualEntry.getState().phase).toBe('choosing');
    await act(async () => useManualEntry.getState().choose(DC));
    expect(screen.getByText('Adjust on map')).toBeTruthy();
    expect(screen.getByText('Edit the grid, or adjust the spot on the map.')).toBeTruthy();
    expect(screen.getByLabelText('Easting')).toHaveDisplayValue(mgrsFieldsFor(DC).easting);
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(DC).northing);
    expect(useManualEntry.getState().pending).not.toBeNull();
  });

  it('keeps Set disabled until the grid is valid, with nothing pending', async () => {
    useManualEntry.getState().open('map', null);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    expect(setPressable()).toBeDisabled();
    expect(useManualEntry.getState().pending).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Easting'), '123');
    expect(setPressable()).toBeDisabled();
  });

  it('Set from the map saves the position, shows the message that stays, and closes', async () => {
    useManualEntry.getState().open('map', null);
    useManualEntry.getState().choose(DC);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    await fireEvent.press(setPressable());
    const { source, manual } = useMyLocation.getState();
    expect(source).toBe('manual');
    expect(manual?.lat).toBeCloseTo(DC.lat, 4);
    expect(manual?.lon).toBeCloseTo(DC.lon, 4);
    expect(useToast.getState().toast).toMatchObject({ message: MESSAGE, kind: 'info', sticky: true });
    expect(useManualEntry.getState().phase).toBe('closed');
  });

  it('Set from Settings saves without the message, starting from the saved position', async () => {
    useManualEntry.getState().open('settings', DC);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    expect(screen.getByText('Adjust on map')).toBeTruthy();
    await fireEvent.press(setPressable());
    expect(useMyLocation.getState().source).toBe('manual');
    expect(useToast.getState().toast).toBeNull();
  });

  it('closes without saving', async () => {
    useManualEntry.getState().open('map', null);
    useManualEntry.getState().choose(DC);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(useManualEntry.getState().phase).toBe('closed');
    expect(useMyLocation.getState().manual).toBeNull();
  });
});
