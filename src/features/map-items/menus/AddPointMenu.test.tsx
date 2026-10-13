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
import { AddPointMenu } from './AddPointMenu';

const CENTER = { lat: 38.8977, lon: -77.0365 };
const OTHER = { lat: 38.95, lon: -77.1 };

beforeEach(() => {
  jest.clearAllMocks();
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: CENTER, zoom: 14, bearing: 0 });
  useMenu.getState().openMenu('point.add', {});
});

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddPointMenu params={{}} missionId="m1" />, ctx);
  await screen.findByDisplayValue('HOS-1');
  return ctx;
}

const items = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeMissionItems(ctx.db, 'm1'));

describe('AddPointMenu', () => {
  it('starts at the crosshair with an auto name', async () => {
    await open();
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(CENTER).northing);
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: CENTER, coordSource: 'crosshair' });
    expect(screen.getByLabelText('Hostile')).toBeSelected();
  });

  it('adds the point, plays a success haptic and stays open for the next one', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item).toMatchObject({ name: 'HOS-1', sidc: composeSidc('hostile', 'unspecified') });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(await screen.findByDisplayValue('HOS-2')).toBeTruthy();
    expect(useDraft.getState()).toMatchObject({ mode: 'add', affiliation: 'hostile', coord: CENTER });
  });

  it('never gives two points the same name when Add is tapped twice quickly', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Add'));
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect((await items(ctx)).length).toBeGreaterThanOrEqual(1));
    const names = (await items(ctx)).map((i) => i.name);
    expect(names.length).toBeLessThanOrEqual(2);
    expect(new Set(names).size).toBe(names.length);
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

  it('uses the crosshair or the user for Center and Me', async () => {
    await open();
    expect(screen.getByLabelText('Me')).toBeDisabled();
    await act(async () => usePresence.getState().setSelfPosition({ position: OTHER, accuracyM: 5, timestamp: 1 }));
    await fireEvent.press(screen.getByLabelText('Me'));
    expect(useDraft.getState()).toMatchObject({ coord: OTHER, coordSource: 'self' });
    await fireEvent.press(screen.getByLabelText('Center'));
    expect(useDraft.getState()).toMatchObject({ coord: CENTER, coordSource: 'crosshair' });
  });

  it('cancels', async () => {
    await open();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(useMenu.getState().stack).toEqual([]);
  });
});
