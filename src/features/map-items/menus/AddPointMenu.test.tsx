import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { setElevationSource } from '@/features/map/terrain/elevation';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { selectOptionLabels } from '@/test-utils/menu-select';
import { renderWithProviders } from '@/test-utils/render';

import { placePoint } from '../commands';
import { observeMissionItems } from '../repository';
import { AddPointMenu } from './AddPointMenu';

const CENTER = { lat: 38.8977, lon: -77.0365 };
const OTHER = { lat: 38.95, lon: -77.1 };

beforeEach(() => {
  jest.clearAllMocks();
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: CENTER, zoom: 14, bearing: 0 });
  useMenu.getState().openMenu('point.add', {});
  useSettings.setState(DEFAULT_SETTINGS);
});

afterEach(() => setElevationSource(null));

/** The nearest ancestor laying its children out in a row, or null when there is none. */
function rowOf(el: ReturnType<typeof screen.getByLabelText>) {
  let node = el.parent;
  while (node && !/\bflex-row\b/.test(String(node.props.className ?? ''))) node = node.parent;
  return node!;
}

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddPointMenu params={{}} missionId="m1" />, ctx);
  await screen.findByDisplayValue('CP-1');
  return ctx;
}

const items = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeMissionItems(ctx.db, 'm1'));

describe('AddPointMenu', () => {
  it('starts at the crosshair as a checkpoint named CP-1, with no affiliation or unit type', async () => {
    await open();
    expect(screen.getByRole('header')).toHaveTextContent('Add point');
    expect(screen.getByLabelText('Point type: Checkpoint')).toBeTruthy();
    expect(screen.queryByLabelText('Hostile')).toBeNull();
    expect(screen.queryByLabelText(/^Unit type/)).toBeNull();
    expect(useDraft.getState()).toMatchObject({ mode: 'add', category: 'point', coord: CENTER });
  });

  it('gives Name and Point type each their own row', async () => {
    await open();
    // Name sits in no side-by-side row at all (rowOf finds none), so nothing shares its line.
    const row = rowOf(screen.getByLabelText('Name')) as ReturnType<typeof rowOf> | null;
    expect(row === null || within(row).queryByLabelText('Point type: Checkpoint') === null).toBe(true);
    expect(screen.getByLabelText('Point type: Checkpoint')).toBeTruthy();
  });

  it('puts Notes in its own section after the point type, not beside it', async () => {
    await open();
    // The section label's row, then the section itself.
    const typeSection = screen.getByText('Point type').parent!.parent!;
    expect(within(typeSection).queryByLabelText('Notes')).toBeNull();
    expect(within(typeSection).getByLabelText('Point type: Checkpoint')).toBeTruthy();
  });

  it('shows the ground elevation at the point and saves it with the point', async () => {
    setElevationSource(async () => 312.4);
    const ctx = await open();
    expect(await screen.findByLabelText('Altitude 312 m')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect((await items(ctx))[0].elevationM).toBe(312.4);
  });

  it('shows elevation as an ALT line, muted while unknown', async () => {
    let answer: ((m: number) => void) | null = null;
    setElevationSource(() => new Promise((resolve) => (answer = resolve)));
    await open();
    await waitFor(() => expect(answer).not.toBeNull());
    expect(screen.getByLabelText('Altitude unknown')).toHaveTextContent('ALT —');
    await act(async () => answer!(312.4));
    expect(await screen.findByLabelText('Altitude 312 m')).toHaveTextContent('ALT 312 m');
    expect(screen.getByTestId('location-elevation')).toHaveTextContent('ALT 312 m');
  });

  it('shows elevation in feet with the Altitude setting', async () => {
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

  it('saves the elevation of where the point ends up, even when Add comes before the display catches up', async () => {
    setElevationSource(async (c) => (Math.abs(c.lat - OTHER.lat) < 0.001 ? 50 : 312));
    const ctx = await open();
    await screen.findByLabelText('Altitude 312 m');
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect((await items(ctx))[0].elevationM).toBe(50);
  });

  it('renames with the type and adds the point, then shows it selected', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Point type: Checkpoint'));
    await fireEvent.press(screen.getByText('Landing zone'));
    expect(await screen.findByDisplayValue('LZ-1')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'cold LZ');
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item).toMatchObject({ name: 'LZ-1', sidc: 'GFGPAAL-------X', notes: 'cold LZ' });
    expect(useMenu.getState().stack).toEqual([{ id: 'point.edit', params: { itemId: item.id } }]);
  });

  it('numbers each type separately', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: CENTER, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    await placePoint(ctx, { missionId: 'm1', coord: CENTER, sidc: composeSidc('hostile', 'infantry'), name: 'HOS-1' });
    await renderWithProviders(<AddPointMenu params={{}} missionId="m1" />, ctx);
    expect(await screen.findByDisplayValue('CP-2')).toBeTruthy();
  });

  it('the Map hint names a point', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Map'));
    expect(screen.getByText('Tap the map where the point should go')).toBeTruthy();
  });

  it('names an artillery target TGT-1', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Point type: Checkpoint'));
    await fireEvent.press(screen.getByText('Target'));
    expect(await screen.findByDisplayValue('TGT-1')).toBeTruthy();
  });


  it('lists point types alphabetically', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Point type: Checkpoint'));
    const labels = selectOptionLabels();
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(labels).toHaveLength(16);
  });
});
