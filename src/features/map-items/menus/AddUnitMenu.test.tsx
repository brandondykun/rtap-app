import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { setElevationSource } from '@/features/map/terrain/elevation';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { selectOptionLabels } from '@/test-utils/menu-select';
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
  useSettings.setState(DEFAULT_SETTINGS);
});

afterEach(() => setElevationSource(null));

/** The nearest ancestor laying its children out in a row (a MenuColumns). */
function rowOf(el: ReturnType<typeof screen.getByLabelText>) {
  let node = el.parent;
  while (node && !/\bflex-row\b/.test(String(node.props.className ?? ''))) node = node.parent;
  return node!;
}

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddUnitMenu params={{}} missionId="m1" />, ctx);
  await screen.findByDisplayValue('HOS-1');
  return ctx;
}

const items = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeMissionItems(ctx.db, 'm1'));

describe('AddUnitMenu', () => {
  it('shows range fields by unit type', async () => {
    await open();
    expect(screen.queryByLabelText('Threat range')).toBeNull();
    expect(screen.queryByLabelText('Horizontal')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    await fireEvent.press(screen.getByText('Artillery'));
    expect(screen.getByLabelText('Threat range')).toBeTruthy();
    expect(screen.queryByLabelText('Horizontal')).toBeNull();
    expect(screen.queryByLabelText('Vertical (ceiling)')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Unit type: Artillery'));
    await fireEvent.press(screen.getByText('Air defense'));
    expect(screen.queryByLabelText('Threat range')).toBeNull();
    expect(screen.getByLabelText('Horizontal')).toBeTruthy();
    expect(screen.getByLabelText('Vertical (ceiling)')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unit type: Air defense'));
    await fireEvent.press(screen.getByText('Infantry'));
    expect(screen.queryByLabelText('Horizontal')).toBeNull();
    expect(screen.queryByLabelText('Show on map')).toBeNull();
  });

  it('gives Affiliation its own row, not beside Name', async () => {
    await open();
    // Name sits in no side-by-side row at all (rowOf finds none), so nothing shares its line.
    const row = rowOf(screen.getByLabelText('Name')) as ReturnType<typeof rowOf> | null;
    expect(row === null || within(row).queryByLabelText('Hostile') === null).toBe(true);
    expect(screen.getByLabelText('Hostile')).toBeTruthy();
  });

  it('orders the top of the form Name, then MGRS, then Affiliation', async () => {
    await open();
    const labels = screen.getAllByText(/^(Name|MGRS · .*|Affiliation)$/).map((t) => String(t.props.children));
    expect(labels.map((l) => (l.startsWith('MGRS') ? 'MGRS' : l))).toEqual(['Name', 'MGRS', 'Affiliation']);
  });

  it('says there is no threat ring for a Reconnaissance draft', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    await fireEvent.press(screen.getByText('Reconnaissance'));
    expect(screen.getByTestId('no-ring')).toHaveTextContent('No threat ring for Reconnaissance units');
    expect(screen.queryByTestId('ring-box')).toBeNull();
  });

  it('puts both air defense ranges in the ring box, with no switch in Add', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    await fireEvent.press(screen.getByText('Air defense'));
    const box = screen.getByTestId('ring-box');
    expect(within(box).getByText('THREAT RING')).toBeTruthy();
    expect(within(box).getByLabelText('Horizontal')).toBeTruthy();
    expect(within(box).getByLabelText('Vertical (ceiling)')).toBeTruthy();
    expect(within(box).queryByLabelText('Show on map')).toBeNull();
    expect(screen.queryByTestId('no-ring')).toBeNull();
  });

  it('disables Add for an out-of-bounds range', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    await fireEvent.press(screen.getByText('Artillery'));
    await fireEvent.changeText(screen.getByLabelText('Threat range'), '500001');
    expect(screen.getByLabelText('Add')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Threat range'), '500000');
    expect(screen.getByLabelText('Add')).toBeEnabled();
  });

  it('starts at the crosshair with an auto name', async () => {
    await open();
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(CENTER).northing);
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: CENTER, coordSource: 'crosshair' });
    expect(screen.getByLabelText('Hostile')).toBeSelected();
  });

  it('clears the name with the × and keeps it empty', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Clear Name'));
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Add')).toBeDisabled();
    expect(screen.queryByLabelText('Clear Name')).toBeNull();
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
    expect(screen.getByLabelText('Center')).toHaveTextContent('CTR', { exact: true });
    await fireEvent.press(screen.getByLabelText('Center'));
    expect(useDraft.getState()).toMatchObject({ coord: CENTER, coordSource: 'crosshair' });
  });

  it('cancels', async () => {
    await open();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(useMenu.getState().stack).toEqual([]);
  });


  it('offers an Echelon picker that defaults to Unspecified and sets the symbol', async () => {
    await open();
    expect(screen.getByLabelText('Echelon: Unspecified')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Echelon: Unspecified'));
    await fireEvent.press(screen.getByText('Company'));
    expect(useDraft.getState().echelon).toBe('company');
    expect(screen.getByLabelText('Echelon: Company')).toBeTruthy();
  });

  it('shows the notes field in its own section after Echelon, not beside the unit type', async () => {
    await open();
    // The section label's row, then the section itself.
    const typeSection = screen.getByText('Unit type').parent!.parent!;
    expect(within(typeSection).queryByLabelText('Notes')).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"accessibilityLabel":"Notes"')).toBeGreaterThan(tree.indexOf('"Echelon"'));
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'dug in');
    expect(useDraft.getState().notes).toBe('dug in');
  });

  it('shows the ground elevation at the unit and saves it with the unit', async () => {
    setElevationSource(async () => 312.4);
    const ctx = await open();
    expect(await screen.findByLabelText('Altitude 312 m')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item.elevationM).toBe(312.4);
  });

  it('shows elevation in feet with the Altitude setting, and a dash while unknown', async () => {
    useSettings.setState({ altitudeUnit: 'ft' });
    setElevationSource(async () => 312.4);
    await open();
    expect(await screen.findByLabelText('Altitude 1025 ft')).toBeTruthy();
  });

  it('saves an unknown elevation when the map has none, without blocking Add', async () => {
    const ctx = await open();
    expect(screen.getByLabelText('Altitude unknown')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect((await items(ctx))[0].elevationM).toBeNull();
  });

  it('saves the elevation of where the unit ends up, even when Add comes before the display catches up', async () => {
    setElevationSource(async (c) => (Math.abs(c.lat - OTHER.lat) < 0.001 ? 50 : 312));
    const ctx = await open();
    await screen.findByLabelText('Altitude 312 m');
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect((await items(ctx))[0].elevationM).toBe(50);
  });

  it('lists unit types alphabetically', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    expect(selectOptionLabels()).toEqual(['Air defense', 'Armor', 'Artillery', 'Engineer', 'Infantry', 'Medical', 'Reconnaissance', 'Unspecified']);
  });
});
