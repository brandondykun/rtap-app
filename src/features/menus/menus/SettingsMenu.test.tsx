import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { declination } from '@/lib/geo/north/magnetic';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { DEFAULT_PROFILE, useProfile } from '@/stores/profile';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { SettingsMenu } from './SettingsMenu';

const DC = { lat: 38.8977, lon: -77.0365 };

const mockRouter = { push: jest.fn() };
// A getter: the mock factory runs before mockRouter is assigned.
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
  useMenu.setState(INITIAL_MENU);
  useProfile.setState(DEFAULT_PROFILE);
});

describe('SettingsMenu', () => {
  it('starts with your callsign, saved in capitals when the edit finishes', async () => {
    useProfile.getState().setCallsign('VIPER 6');
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getAllByTestId(/^menu-section-/).map((s) => s.props.testID)).toContain('menu-section-Callsign');
    const field = screen.getByLabelText('Callsign');
    expect(field.props.value).toBe('VIPER 6');
    await fireEvent.changeText(field, 'red one');
    expect(useProfile.getState().callsign).toBe('VIPER 6');
    await fireEvent(field, 'submitEditing');
    expect(useProfile.getState().callsign).toBe('RED ONE');
    expect(field.props.value).toBe('RED ONE');
  });

  it('explains the rule and keeps the old callsign when the new one is not valid', async () => {
    useProfile.getState().setCallsign('VIPER 6');
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    const field = screen.getByLabelText('Callsign');
    await fireEvent.changeText(field, 'viper_6');
    await fireEvent(field, 'blur');
    expect(screen.getByText('Up to 16 letters, numbers, spaces or hyphens')).toBeTruthy();
    expect(useProfile.getState().callsign).toBe('VIPER 6');
  });

  it('opens the callsign screen from About callsigns, and shows what it saved', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByTestId('about-callsigns-icon')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'About callsigns' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/callsign');
    await act(() => void useProfile.getState().setCallsign('HAWK'));
    expect(screen.getByLabelText('Callsign').props.value).toBe('HAWK');
  });

  it('saves a typed callsign when the menu closes with the keyboard up', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent.changeText(screen.getByLabelText('Callsign'), 'hawk');
    await screen.unmount();
    expect(useProfile.getState().callsign).toBe('HAWK');
  });

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
    expect(screen.getByTestId('gm-angle-other')).toHaveTextContent(/^\d+ mils [EW]$/);
  });

  it('shows the model and manual declination in degrees and mils', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText(/^Declination here \(true → magnetic, WMM2025\):\s\d+\.\d° [EW] · \d+ mils [EW]$/)).toBeTruthy();
    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Declination degrees'), '-9.5');
    expect(screen.getByText('Manual declination (true → magnetic): 9.5° W · 169 mils W')).toBeTruthy();
  });

  it('shows the G-M angle at the crosshair', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByTestId('gm-angle')).toHaveTextContent(/^\d+\.\d° [EW]$/);
    expect(screen.getByTestId('gm-angle-other')).toHaveTextContent(/^\d+ mils [EW]$/);
  });

  it('shows the G-M angle in the chosen angle unit with a grid → magnetic label', async () => {
    useSettings.getState().setAngleUnit('mil');
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('G-M angle here · grid → magnetic')).toBeTruthy();
    expect(screen.getByTestId('gm-angle')).toHaveTextContent(/^\d+ mils [EW]$/);
    expect(screen.getByTestId('gm-angle-other')).toHaveTextContent(/^\d+\.\d° [EW]$/);
  });

  // On zone 31's central meridian at the equator grid north is true north, so the G-M angle is the declination.
  const ON_CENTRAL_MERIDIAN = { lat: 0, lon: 3 };

  it('says to add grid → magnetic and subtract magnetic → grid where magnetic north is west of grid north', async () => {
    useInteraction.getState().setCamera({ center: ON_CENTRAL_MERIDIAN, zoom: 12, bearing: 0 });
    useSettings.getState().setDeclinationOverride(-10);
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByTestId('gm-grid-to-magnetic')).toHaveTextContent('Grid → magnetic: add 10.0°');
    expect(screen.getByTestId('gm-magnetic-to-grid')).toHaveTextContent('Magnetic → grid: subtract 10.0°');
  });

  it('says the reverse where magnetic north is east of grid north, in the chosen angle unit', async () => {
    useInteraction.getState().setCamera({ center: ON_CENTRAL_MERIDIAN, zoom: 12, bearing: 0 });
    useSettings.getState().setDeclinationOverride(10);
    useSettings.getState().setAngleUnit('mil');
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByTestId('gm-grid-to-magnetic')).toHaveTextContent('Grid → magnetic: subtract 178 mils');
    expect(screen.getByTestId('gm-magnetic-to-grid')).toHaveTextContent('Magnetic → grid: add 178 mils');
  });

  it('says grid and magnetic north agree when the G-M angle is zero', async () => {
    useInteraction.getState().setCamera({ center: ON_CENTRAL_MERIDIAN, zoom: 12, bearing: 0 });
    useSettings.getState().setDeclinationOverride(0);
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('Grid and magnetic north agree here: nothing to add or subtract.')).toBeTruthy();
    expect(screen.queryByTestId('gm-grid-to-magnetic')).toBeNull();
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

  it('turns minimal landscape grids on and off (off by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Minimal grids in landscape').props.value).toBe(false);
    await fireEvent(screen.getByLabelText('Minimal grids in landscape'), 'valueChange', true);
    expect(useSettings.getState().minimalLandscapeGrids).toBe(true);
    expect(screen.getByLabelText('Minimal grids in landscape').props.value).toBe(true);
  });

  it('shows or hides the center grid (shown by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Show center grid').props.value).toBe(true);
    await fireEvent(screen.getByLabelText('Show center grid'), 'valueChange', false);
    expect(useSettings.getState().showCenterGrid).toBe(false);
    expect(screen.getByLabelText('Show center grid').props.value).toBe(false);
  });

  it('shows or hides the MGRS grid (hidden by default) and its labels, which only switch while the grid shows', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Show MGRS grid').props.value).toBe(false);
    expect(screen.getByLabelText('Show grid labels')).toBeDisabled();
    await fireEvent(screen.getByLabelText('Show MGRS grid'), 'valueChange', true);
    expect(useSettings.getState().showMgrsGrid).toBe(true);
    expect(screen.getByLabelText('Show grid labels')).not.toBeDisabled();
    await fireEvent(screen.getByLabelText('Show grid labels'), 'valueChange', false);
    expect(useSettings.getState().showGridLabels).toBe(false);
  });

  it('shows or hides the 100 m grid lines (shown by default), only while the grid shows', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Show 100 m grid lines').props.value).toBe(true);
    expect(screen.getByLabelText('Show 100 m grid lines')).toBeDisabled();
    await fireEvent(screen.getByLabelText('Show MGRS grid'), 'valueChange', true);
    await fireEvent(screen.getByLabelText('Show 100 m grid lines'), 'valueChange', false);
    expect(useSettings.getState().showGrid100m).toBe(false);
  });

  it('picks the grid color from white (the default) to black, only while the grid shows', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('Grid color')).toBeTruthy();
    expect(screen.getByLabelText('White')).toBeSelected();
    for (const shade of ['White', 'Light gray', 'Gray', 'Dark gray', 'Black']) expect(screen.getByLabelText(shade)).toBeDisabled();
    await fireEvent(screen.getByLabelText('Show MGRS grid'), 'valueChange', true);
    await fireEvent.press(screen.getByLabelText('Black'));
    expect(useSettings.getState().gridColor).toBe('black');
    expect(screen.getByLabelText('Black')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Light gray'));
    expect(useSettings.getState().gridColor).toBe('light-gray');
  });

  it('shows or hides the toolbar text (shown by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Show toolbar text').props.value).toBe(true);
    await fireEvent(screen.getByLabelText('Show toolbar text'), 'valueChange', false);
    expect(useSettings.getState().showToolbarText).toBe(false);
  });

  it('groups the settings under titled headings, in order', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getAllByTestId(/^menu-group-/).map((g) => g.props.testID)).toEqual([
      'menu-group-Location',
      'menu-group-Profile',
      'menu-group-Map',
      'menu-group-MGRS grid',
      'menu-group-Units',
      'menu-group-North & declination',
      'menu-group-Display',
    ]);
    expect(screen.getAllByRole('header').length).toBeGreaterThanOrEqual(6);
  });

  it('switches the basemap', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    // First section of the Map group.
    expect(within(screen.getByTestId('menu-group-Map')).getAllByTestId(/^menu-section-/)[0].props.testID).toBe('menu-section-Basemap');
    expect(screen.getByLabelText('Satellite')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Topo'));
    expect(useSettings.getState().basemap).toBe('topo');
    expect(screen.getByLabelText('Topo')).toBeSelected();
    expect(screen.queryByText('Offline map downloads use Satellite.')).toBeNull();
  });

  it('sets the label text size (Medium by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('Label text size')).toBeTruthy();
    expect(screen.getByLabelText('Medium')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Small'));
    expect(useSettings.getState().labelSize).toBe('small');
    expect(screen.getByLabelText('Small')).toBeSelected();
  });

  it('sets how see-through the map panels are (Heavy by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('Panel background')).toBeTruthy();
    expect(screen.getByLabelText('Heavy')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Light'));
    expect(useSettings.getState().panelBackground).toBe('light');
    expect(screen.getByLabelText('Light')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Clear'));
    expect(useSettings.getState().panelBackground).toBe('clear');
    await fireEvent.press(screen.getByLabelText('Solid'));
    expect(useSettings.getState().panelBackground).toBe('solid');
  });

  it('sets the 3D terrain height (1.5x by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText('3D terrain height')).toBeTruthy();
    expect(screen.getByLabelText('1.5×')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('3×'));
    expect(useSettings.getState().terrainExaggeration).toBe(3);
    expect(screen.getByLabelText('3×')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('1×'));
    expect(useSettings.getState().terrainExaggeration).toBe(1);
  });

  it('turns terrain in 2D off and on (on by default)', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByLabelText('Terrain in 2D').props.value).toBe(true);
    await fireEvent(screen.getByLabelText('Terrain in 2D'), 'valueChange', false);
    expect(useSettings.getState().terrainIn2d).toBe(false);
    expect(screen.getByLabelText('Terrain in 2D').props.value).toBe(false);
  });

  it('closes', async () => {
    useMenu.getState().openMenu('settings', {});
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(useMenu.getState().stack).toEqual([]);
  });
});
