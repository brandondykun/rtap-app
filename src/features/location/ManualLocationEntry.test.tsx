import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { bannerTop, EDGE, GAP, TOOLBAR_HEIGHT } from '@/features/map/layout';
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

  it('Cancel closes without saving, and there is no corner ✕', async () => {
    useManualEntry.getState().open('map', null);
    useManualEntry.getState().choose(DC);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    expect(screen.queryByLabelText('Close')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(useManualEntry.getState().phase).toBe('closed');
    expect(useMyLocation.getState().manual).toBeNull();
  });

  it('draws Choose on map and Adjust on map as solid buttons, not see-through ones that look disabled', async () => {
    useManualEntry.getState().open('map', null);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    const choose = screen.getByLabelText('Choose on map');
    expect(choose.props.className).toContain('bg-surface-raised');
    expect(choose.props.className).not.toContain('bg-surface-glass');
    await act(async () => useManualEntry.getState().choose(DC));
    expect(screen.getByLabelText('Adjust on map').props.className).toContain('bg-surface-raised');
  });

  it('draws its title and hint in the full text color, not the hard-to-read muted gray', async () => {
    useManualEntry.getState().open('map', null);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    for (const text of ['MY POSITION', 'Type your grid, or choose your spot on the map.']) {
      expect(screen.getByText(text).props.className).toMatch(/\btext-text\b(?!-)/);
      expect(screen.getByText(text).props.className).not.toContain('text-text-muted');
    }
  });

  it('dims Set only lightly while the grid is invalid', async () => {
    useManualEntry.getState().open('map', null);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    expect(setPressable().props.className).toContain('opacity-70');
    expect(setPressable().props.className).not.toMatch(/(^|\s)opacity-40\b/);
    await act(async () => useManualEntry.getState().choose(DC));
    expect(setPressable().props.className).not.toMatch(/(^|\s)opacity-\d/);
  });

  it('puts Choose on map, Cancel and Set in one row in landscape, and Choose on map on its own row in portrait', async () => {
    useManualEntry.getState().open('map', null);
    await renderWithProviders(<ManualLocationEntry landscape />);
    const row = within(screen.getByTestId('manual-location-actions'));
    for (const label of ['Choose on map', 'Cancel', 'Set']) expect(row.getByLabelText(label)).toBeTruthy();
    await screen.unmount();

    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    const portraitRow = within(screen.getByTestId('manual-location-actions'));
    expect(portraitRow.getByLabelText('Cancel')).toBeTruthy();
    expect(portraitRow.getByLabelText('Set')).toBeTruthy();
    expect(portraitRow.queryByLabelText('Choose on map')).toBeNull();
  });

  it('sits below the Mapbox logo in portrait, and right under the toolbar in landscape', async () => {
    useManualEntry.getState().open('map', null);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    expect(screen.getByTestId('manual-location-frame')).toHaveStyle({ top: bannerTop(false) });
    await screen.unmount();

    await renderWithProviders(<ManualLocationEntry landscape />);
    expect(screen.getByTestId('manual-location-frame')).toHaveStyle({ top: EDGE + TOOLBAR_HEIGHT + GAP });
  });

  it('has a clear button right of the grid that empties the fields', async () => {
    useManualEntry.getState().open('map', null);
    useManualEntry.getState().choose(DC);
    await renderWithProviders(<ManualLocationEntry landscape={false} />);
    const row = within(screen.getByTestId('manual-location-grid-row'));
    await fireEvent.press(row.getByLabelText('Clear grid'));
    for (const field of ['MGRS zone', '100 km square', 'Easting', 'Northing']) expect(screen.getByLabelText(field)).toHaveDisplayValue('');
    expect(setPressable()).toBeDisabled();
    expect(useManualEntry.getState().pending).toBeNull();
  });
});
