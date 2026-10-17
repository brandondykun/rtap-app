import { act, fireEvent, screen } from '@testing-library/react-native';

import { declination } from '@/lib/geo/north/magnetic';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { SettingsMenu } from './SettingsMenu';

const DC = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
  useMenu.setState(INITIAL_MENU);
});

describe('SettingsMenu', () => {
  it('changes coordinate format, angle unit and north reference', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByLabelText('Lat/Lon'));
    await fireEvent.press(screen.getByLabelText('Mils'));
    await fireEvent.press(screen.getByLabelText('Magnetic'));
    expect(useSettings.getState()).toMatchObject({
      coordinateFormat: 'latlon',
      angleUnit: 'mil',
      northRef: 'magnetic',
    });
  });

  it('starts a manual declination at the model value and validates edits', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', true);
    const model = Math.round(declination(DC, new Date()) * 10) / 10;
    expect(useSettings.getState().declinationOverrideDeg).toBe(model);

    const field = screen.getByLabelText('Declination degrees');
    await fireEvent.changeText(field, '200');
    await fireEvent(field, 'endEditing');
    expect(screen.getByText('Enter a number from −180 to 180 (east positive)')).toBeTruthy();
    expect(useSettings.getState().declinationOverrideDeg).toBe(model);

    await fireEvent.changeText(field, '-9.5');
    await fireEvent(field, 'endEditing');
    expect(useSettings.getState().declinationOverrideDeg).toBe(-9.5);
    expect(screen.queryByText('Enter a number from −180 to 180 (east positive)')).toBeNull();

    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', false);
    expect(useSettings.getState().declinationOverrideDeg).toBeNull();
  });

  it('saves a typed declination only when the edit finishes, never the partial values', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', true);
    const start = useSettings.getState().declinationOverrideDeg;
    const field = screen.getByLabelText('Declination degrees');
    await fireEvent.changeText(field, '2');
    await fireEvent.changeText(field, '20');
    await fireEvent.changeText(field, '200');
    expect(useSettings.getState().declinationOverrideDeg).toBe(start);
    await fireEvent(field, 'endEditing');
    expect(useSettings.getState().declinationOverrideDeg).toBe(start);
    expect(screen.getByText('Enter a number from −180 to 180 (east positive)')).toBeTruthy();
    await fireEvent.changeText(field, '-9.5');
    expect(useSettings.getState().declinationOverrideDeg).toBe(start);
    await fireEvent(field, 'endEditing');
    expect(useSettings.getState().declinationOverrideDeg).toBe(-9.5);
  });

  it('saves a valid typed declination when the menu closes before the edit finishes', async () => {
    const { unmount } = await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Declination degrees'), '-9.5');
    await act(async () => unmount());
    expect(useSettings.getState().declinationOverrideDeg).toBe(-9.5);
  });

  it('keeps the saved declination when the menu closes on invalid or empty text', async () => {
    const { unmount } = await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', true);
    const start = useSettings.getState().declinationOverrideDeg;
    await fireEvent.changeText(screen.getByLabelText('Declination degrees'), '-');
    await act(async () => unmount());
    expect(useSettings.getState().declinationOverrideDeg).toBe(start);
  });

  it('updates the G-M angle and model hint as the camera moves', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    const hint = screen.getByText(/^Declination here \(true → magnetic, WMM2025\):/).props.children;
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 64.1, lon: -21.9 }, zoom: 12, bearing: 0 }));
    expect(screen.getByText(/^Declination here \(true → magnetic, WMM2025\):/).props.children).not.toBe(hint);
    expect(screen.getByTestId('gm-angle')).toHaveTextContent(/^\d+\.\d° [EW]$/);
  });

  it('shows the model and manual declination in degrees and mils', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText(/^Declination here \(true → magnetic, WMM2025\): \d+\.\d° [EW] · \d+ mils [EW]$/)).toBeTruthy();
    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Declination degrees'), '-9.5');
    expect(screen.getByText('Manual declination (true → magnetic): 9.5° W · 169 mils W')).toBeTruthy();
  });

  it('shows the G-M angle at the crosshair', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByTestId('gm-angle')).toHaveTextContent(/^\d+\.\d° [EW]$/);
  });

  it('shows the G-M angle in the chosen angle unit with a grid → magnetic label', async () => {
    useSettings.getState().setAngleUnit('mil');
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('G-M angle here · grid → magnetic')).toBeTruthy();
    expect(screen.getByTestId('gm-angle')).toHaveTextContent(/^\d+ mils [EW]$/);
  });

  it('switches the altitude unit between meters and feet', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Meters')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Feet'));
    expect(useSettings.getState().altitudeUnit).toBe('ft');
    expect(screen.getByLabelText('Feet')).toBeSelected();
  });

  it('shows or hides the zoom buttons (shown by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Show zoom buttons').props.value).toBe(true);
    await fireEvent(screen.getByLabelText('Show zoom buttons'), 'valueChange', false);
    expect(useSettings.getState().showZoomButtons).toBe(false);
    expect(screen.getByLabelText('Show zoom buttons').props.value).toBe(false);
  });

  it('shows or hides the toolbar text (shown by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Show toolbar text').props.value).toBe(true);
    await fireEvent(screen.getByLabelText('Show toolbar text'), 'valueChange', false);
    expect(useSettings.getState().showToolbarText).toBe(false);
  });

  it('switches the basemap', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    // First section, right under the header.
    const sections = screen.getAllByText(/^(Basemap|Coordinates|Angles|Altitude|North reference|Declination|Map)$/).map((t) => t.props.children);
    expect(sections[0]).toBe('Basemap');
    expect(screen.getByLabelText('Satellite')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Topo'));
    expect(useSettings.getState().basemap).toBe('topo');
    expect(screen.getByLabelText('Topo')).toBeSelected();
    expect(screen.getByText('Offline map downloads use Satellite.')).toBeTruthy();
  });

  it('sets the label text size (Medium by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('Label text size')).toBeTruthy();
    expect(screen.getByLabelText('Medium')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Small'));
    expect(useSettings.getState().labelSize).toBe('small');
    expect(screen.getByLabelText('Small')).toBeSelected();
  });

  it('closes', async () => {
    useMenu.getState().openMenu('settings', {});
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Close'));
    expect(useMenu.getState().stack).toEqual([]);
  });
});
