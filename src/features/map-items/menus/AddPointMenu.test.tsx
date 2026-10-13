import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { selectOptionLabels } from '@/test-utils/menu-select';
import { renderWithProviders } from '@/test-utils/render';

import { placePoint } from '../commands';
import { observeMissionItems } from '../repository';
import { AddPointMenu } from './AddPointMenu';

const CENTER = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => {
  jest.clearAllMocks();
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: CENTER, zoom: 14, bearing: 0 });
  useMenu.getState().openMenu('point.add', {});
});

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

  it('renames with the type and adds the point, then shows it selected', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Point type: Checkpoint'));
    await fireEvent.press(screen.getByText('Landing zone'));
    expect(await screen.findByDisplayValue('LZ-1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Notes'));
    await fireEvent.changeText(screen.getAllByLabelText('Notes').at(-1)!, 'cold LZ');
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
    expect(labels).toHaveLength(9);
  });
});
