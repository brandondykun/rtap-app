import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MANUAL_ENTRY, useManualEntry } from '@/stores/manual-entry';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_PROFILE, useProfile } from '@/stores/profile';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { SettingsMenu } from '../menus/menus/SettingsMenu';

const DC = { lat: 38.8977, lon: -77.0365 };
const NOTICE = 'Location is off. Your GPS position is hidden until you turn it on.';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
  useMenu.setState(INITIAL_MENU);
  useProfile.setState(DEFAULT_PROFILE);
  usePresence.setState(INITIAL_PRESENCE);
  useMyLocation.setState(DEFAULT_MY_LOCATION);
  useManualEntry.setState(INITIAL_MANUAL_ENTRY);
});

const renderSettings = async () => {
  await act(async () => useMenu.getState().openMenu('settings', {}));
  await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
};

describe('Location in Settings', () => {
  it('with location off, shows the notice first, with Open Settings, and GPS greyed out', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    usePresence.getState().setLocationStatus('denied');
    await renderSettings();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    await fireEvent.press(screen.getByText('Open Settings'));
    expect(open).toHaveBeenCalled();
    expect(screen.getByLabelText('GPS').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('has no notice while location is on, and Location comes first', async () => {
    usePresence.getState().setLocationStatus('granted');
    await renderSettings();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getAllByTestId(/^menu-section-/)[0].props.testID).toBe('menu-section-Use my position from');
    expect(screen.getByLabelText('GPS').props.accessibilityState).toMatchObject({ selected: true, disabled: false });
  });

  it('shows the manual position only while Manual is chosen; switching to GPS clears it', async () => {
    usePresence.getState().setLocationStatus('granted');
    await renderSettings();
    expect(screen.queryByTestId('menu-section-Manual position')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Manual'));
    expect(useMyLocation.getState().source).toBe('manual');
    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.getByLabelText('Set')).toBeTruthy();
    await act(async () => useMyLocation.getState().setManual(DC));
    expect(screen.getByText(formatCoordinate(DC, 'mgrs'))).toBeTruthy();
    expect(screen.getByLabelText('Change')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('GPS'));
    expect(useMyLocation.getState()).toMatchObject({ source: 'gps', manual: null });
    expect(screen.queryByTestId('menu-section-Manual position')).toBeNull();
  });

  it('offers the dev Fake GPS switch only while Manual is chosen', async () => {
    await renderSettings();
    expect(screen.queryByLabelText('Fake GPS (dev)')).toBeNull();
    await act(async () => useMyLocation.getState().setManual(DC));
    await fireEvent(screen.getByLabelText('Fake GPS (dev)'), 'valueChange', true);
    expect(useMyLocation.getState().devFakeGps).toBe(true);
  });

  it('Change closes Settings and opens the box with the saved position', async () => {
    useMyLocation.getState().setManual(DC);
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Change'));
    expect(useMenu.getState().stack).toHaveLength(0);
    expect(useManualEntry.getState()).toMatchObject({ phase: 'entry', origin: 'settings', start: DC });
  });

  it('Set with no position opens the empty box from Settings', async () => {
    useMyLocation.getState().switchToManual();
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Set'));
    expect(useManualEntry.getState()).toMatchObject({ phase: 'entry', origin: 'settings', start: null });
  });
});
