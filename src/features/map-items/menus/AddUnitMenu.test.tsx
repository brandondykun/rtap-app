import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { observeMissionItems } from '../repository';
import { AddUnitMenu } from './AddUnitMenu';

const CENTER = { lat: 38.8977, lon: -77.0365 };
const OTHER = { lat: 38.95, lon: -77.1 };

beforeEach(() => {
  jest.clearAllMocks();
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: CENTER, zoom: 14, bearing: 0 });
  useMenu.getState().openMenu('unit.add', {});
});

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddUnitMenu params={{}} missionId="m1" />, ctx);
  await screen.findByDisplayValue('HOS-1');
  return ctx;
}

const items = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeMissionItems(ctx.db, 'm1'));

describe('AddUnitMenu', () => {
  it('starts at the crosshair with an auto name', async () => {
    await open();
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(CENTER).northing);
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: CENTER, coordSource: 'crosshair' });
    expect(screen.getByLabelText('Hostile')).toBeSelected();
  });

  it('adds the point, plays a success haptic and selects it in Edit Point', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item).toMatchObject({ name: 'HOS-1', sidc: composeSidc('hostile', 'unspecified') });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: item.id } }]);
  });

  it('adds only one point when Add is tapped twice', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Add'));
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect(await items(ctx)).toHaveLength(1);
  });

  it('keeps the map still and disables Add while the MGRS is partial', async () => {
    await open();
    const rev = useDraft.getState().coordRev;
    await fireEvent.changeText(screen.getByLabelText('Northing'), '073');
    expect(screen.getByLabelText('Add')).toBeDisabled();
    expect(useDraft.getState()).toMatchObject({ coord: CENTER, coordRev: rev, coordInputValid: false });
  });

  it('moves the draft to a typed reference', async () => {
    await open();
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    const { coord, coordSource } = useDraft.getState();
    expect(coordSource).toBe('typed');
    expect(coord?.lat).toBeCloseTo(OTHER.lat, 3);
    expect(coord?.lon).toBeCloseTo(OTHER.lon, 3);
    expect(screen.getByLabelText('Add')).toBeEnabled();
  });

  it('renames on affiliation change unless the user typed a name', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Friendly'));
    expect(await screen.findByDisplayValue('FRD-1')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByLabelText('Neutral'));
    expect(screen.getByDisplayValue('OBJ IRON')).toBeTruthy();
  });

  it('keeps the form when a long-press moves the draft', async () => {
    await open();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByLabelText('Friendly'));
    await act(async () => useDraft.getState().setCoord(OTHER, 'press'));
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(OTHER).northing);
    expect(screen.getByDisplayValue('OBJ IRON')).toBeTruthy();
    expect(useDraft.getState().affiliation).toBe('friend');
  });

  it('has no Me button; Map toggles picking a location on the map', async () => {
    await open();
    expect(screen.queryByLabelText('Me')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Map'));
    expect(useDraft.getState().picking).toBe(true);
    expect(screen.getByLabelText('Map')).toBeSelected();
    expect(screen.getByText('Tap the map where the unit should go')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Map'));
    expect(useDraft.getState().picking).toBe(false);
  });

  it('Center moves the draft to the crosshair', async () => {
    await open();
    await act(async () => useDraft.getState().setCoord(OTHER, 'press'));
    await fireEvent.press(screen.getByLabelText('Center'));
    expect(useDraft.getState()).toMatchObject({ coord: CENTER, coordSource: 'crosshair' });
  });

  it('cancels', async () => {
    await open();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(useMenu.getState().stack).toEqual([]);
  });
});
