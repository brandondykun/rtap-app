import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { placePoint } from '@/features/map-items/commands';
import { AddPointMenu } from '@/features/map-items/menus/AddPointMenu';
import { observeMissionItems } from '@/features/map-items/repository';
import { hiddenFilter } from '@/features/map-items/selectors';
import { PointsLayer } from '@/features/map/layers/PointsLayer';
import { MenuHost } from '@/features/menus/MenuHost';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_LAYERS_VIEW, useLayersView } from '@/stores/layers-view';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { useToast } from '@/stores/toast';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { createOverlay, setItemInOverlay, setOverlayHidden } from './commands';
import { ItemOverlaysSection, itemOverlaysHint } from './ItemOverlaysSection';
import { observeBaseHidden, observeItemOverlayIds, observeMissionOverlays } from './repository';

jest.mock('@rnmapbox/maps');
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const at = { lat: 38.9, lon: -77 };
const HOS = 'SHGPUCI--------';
const M = 'm1';

beforeEach(() => {
  useMenu.setState(INITIAL_MENU);
  useLayersView.setState(INITIAL_LAYERS_VIEW);
  useToast.setState({ toast: null });
});

async function withOverlay() {
  const ctx = makeTestContext();
  const item = await placePoint(ctx, { missionId: M, coord: at, sidc: HOS, name: 'HOS-1' });
  const o = await createOverlay(ctx, { missionId: M, name: 'Phase 1' });
  if (!item.ok || !o.ok) throw new Error('setup');
  return { ctx, itemId: item.value.id, overlayId: o.value.id };
}

async function openLayers(ctx: ReturnType<typeof makeTestContext>, { overlaysOpen = true } = {}) {
  useLayersView.setState({ overlaysOpen });
  await renderWithProviders(<MenuHost landscape={false} missionId={M} />, ctx);
  await act(async () => useMenu.getState().openMenu('layers', {}));
  await screen.findByText('Layers');
}

describe('overlays in Layers', () => {
  it('starts closed to one line saying how many are on, and opens to a tile per overlay', async () => {
    const { ctx, overlayId } = await withOverlay();
    await setOverlayHidden(ctx, overlayId, true);
    await openLayers(ctx, { overlaysOpen: false });
    const header = await screen.findByLabelText('Overlays, 1 of 2 on');
    expect(screen.getByTestId('layers-overlays-summary')).toHaveTextContent('1/2 on');
    expect(header).not.toBeExpanded();
    expect(screen.queryByTestId('layers-overlays')).toBeNull();
    await fireEvent.press(header);
    expect(useLayersView.getState().overlaysOpen).toBe(true);
    expect(within(screen.getByTestId('layers-overlays')).getByLabelText('Show Phase 1')).toBeTruthy();
  });

  it('shows every overlay from All while any is off, and hides them all once all are on', async () => {
    const { ctx, overlayId } = await withOverlay();
    await setOverlayHidden(ctx, overlayId, true);
    await openLayers(ctx, { overlaysOpen: false });
    await fireEvent.press(await screen.findByLabelText('Show all overlays'));
    expect(await screen.findByLabelText('Overlays, 2 of 2 on')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Hide all overlays'));
    expect(await screen.findByLabelText('Overlays, 0 of 2 on')).toBeTruthy();
    expect(await firstValueFrom(observeBaseHidden(ctx.db, M))).toBe(true);
    expect((await firstValueFrom(observeMissionOverlays(ctx.db, M)))[0].hidden).toBe(true);
  });

  it('counts the items in each overlay, Base those in none', async () => {
    const { ctx, itemId, overlayId } = await withOverlay();
    await placePoint(ctx, { missionId: M, coord: at, sidc: HOS, name: 'HOS-2' });
    await setItemInOverlay(ctx, { missionId: M, itemId, overlayId, inOverlay: true });
    await openLayers(ctx);
    await waitFor(() => expect(screen.getByTestId('overlay-chip-base')).toHaveTextContent(/Base1$/));
    expect(screen.getByTestId(`overlay-chip-${overlayId}`)).toHaveTextContent(/Phase 11$/);
  });

  it('offers to add an overlay while there are none, opening the Overlays menu (Back returns to Layers)', async () => {
    await openLayers(makeTestContext());
    await fireEvent.press(screen.getByLabelText('Manage overlays'));
    expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['layers', 'overlays']);
    expect(await screen.findByLabelText('New overlay name')).toBeTruthy();
  });

  it('puts Base first, and hides the items in no overlay from its chip', async () => {
    const { ctx } = await withOverlay();
    await openLayers(ctx);
    const chips = within(screen.getByTestId('layers-overlays'));
    await chips.findByLabelText('Hide Phase 1');
    const labels = chips.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.slice(0, 2)).toEqual(['Hide Base', 'Hide Phase 1']);
    await fireEvent.press(chips.getByLabelText('Hide Base'));
    await waitFor(async () => expect(await firstValueFrom(observeBaseHidden(ctx.db, M))).toBe(true));
    expect(await chips.findByLabelText('Show Base')).not.toBeSelected();
  });

  it('shows and hides an overlay from its chip, dimming the rows of items it hides', async () => {
    const { ctx, itemId, overlayId } = await withOverlay();
    await setItemInOverlay(ctx, { missionId: M, itemId, overlayId, inOverlay: true });
    await openLayers(ctx);
    const chip = await within(screen.getByTestId('layers-overlays')).findByLabelText('Hide Phase 1');
    expect(chip).toBeSelected();
    await fireEvent.press(chip);
    await waitFor(async () => expect((await firstValueFrom(observeMissionOverlays(ctx.db, M)))[0].hidden).toBe(true));
    expect(await screen.findByLabelText('Show Phase 1')).not.toBeSelected();
  });
});

describe('Overlays menu', () => {
  async function openMenu(ctx = makeTestContext()) {
    await renderWithProviders(<MenuHost landscape={false} missionId={M} />, ctx);
    await act(async () => useMenu.getState().openMenu('overlays', {}));
    await screen.findByLabelText('New overlay name');
    return ctx;
  }

  it('lists Base first, shown or hidden only (no rename or delete)', async () => {
    const ctx = await openMenu();
    expect(screen.getByText('Base')).toBeTruthy();
    expect(screen.queryByLabelText('Delete Base')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Hide Base'));
    await waitFor(async () => expect(await firstValueFrom(observeBaseHidden(ctx.db, M))).toBe(true));
  });

  it('adds an overlay by name', async () => {
    const ctx = await openMenu();
    await fireEvent.changeText(screen.getByLabelText('New overlay name'), 'Fires');
    await fireEvent.press(screen.getByLabelText('Add overlay'));
    expect(await screen.findByText('Fires')).toBeTruthy();
    expect((await firstValueFrom(observeMissionOverlays(ctx.db, M))).map((o) => o.name)).toEqual(['Fires']);
    expect(screen.getByLabelText('New overlay name')).toHaveDisplayValue('');
  });

  it('says so, and keeps the name typed, when an overlay of that name exists', async () => {
    const { ctx } = await withOverlay();
    await openMenu(ctx);
    await screen.findByText('Phase 1');
    await fireEvent.changeText(screen.getByLabelText('New overlay name'), 'phase 1');
    await fireEvent.press(screen.getByLabelText('Add overlay'));
    await waitFor(() =>
      expect(useToast.getState().toast).toMatchObject({ message: 'There is already an overlay named phase 1.', detail: 'Choose a different name.' }),
    );
    expect(screen.getByLabelText('New overlay name')).toHaveDisplayValue('phase 1');
    expect(await firstValueFrom(observeMissionOverlays(ctx.db, M))).toHaveLength(1);
  });

  it('clears the name fields from their clear buttons', async () => {
    const { ctx } = await withOverlay();
    await openMenu(ctx);
    await fireEvent.changeText(screen.getByLabelText('New overlay name'), 'Fires');
    await fireEvent.press(screen.getByLabelText('Clear New overlay name'));
    expect(screen.getByLabelText('New overlay name')).toHaveDisplayValue('');
    await fireEvent.press(await screen.findByText('Phase 1'));
    await fireEvent.press(screen.getByLabelText('Clear Rename Phase 1'));
    expect(screen.getByLabelText('Rename Phase 1')).toHaveDisplayValue('');
  });

  it('renames an overlay from its row', async () => {
    const { ctx } = await withOverlay();
    await openMenu(ctx);
    await fireEvent.press(await screen.findByText('Phase 1'));
    await fireEvent.changeText(screen.getByLabelText('Rename Phase 1'), 'Phase 2');
    await fireEvent.press(screen.getByLabelText('Save name'));
    expect(await screen.findByText('Phase 2')).toBeTruthy();
  });

  it('deletes an overlay only once confirmed', async () => {
    const { ctx } = await withOverlay();
    await openMenu(ctx);
    await fireEvent.press(await screen.findByLabelText('Delete Phase 1'));
    expect(screen.getByText('Delete overlay?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    await waitFor(() => expect(screen.queryByText('Phase 1')).toBeNull());
  });
});

describe('an item\'s overlays', () => {
  it('shows nothing until the mission has overlays', async () => {
    const ctx = makeTestContext();
    const item = await placePoint(ctx, { missionId: M, coord: at, sidc: HOS, name: 'HOS-1' });
    if (!item.ok) throw new Error('setup');
    await renderWithProviders(<ItemOverlaysSection missionId={M} itemId={item.value.id} />, ctx);
    expect(screen.queryByTestId('item-overlays')).toBeNull();
  });

  it('puts the item in an overlay and takes it out, Base lit while it is in none', async () => {
    const { ctx, itemId, overlayId } = await withOverlay();
    await renderWithProviders(<ItemOverlaysSection missionId={M} itemId={itemId} />, ctx);
    expect(await screen.findByTestId('item-overlays-hint')).toHaveTextContent(/is in Base/);
    expect(screen.getByLabelText('In Base')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Add to Phase 1'));
    await waitFor(async () => expect(await firstValueFrom(observeItemOverlayIds(ctx.db, itemId))).toEqual([overlayId]));
    await fireEvent.press(await screen.findByLabelText('Take out of Phase 1'));
    await waitFor(async () => expect(await firstValueFrom(observeItemOverlayIds(ctx.db, itemId))).toEqual([]));
  });

  it('moves the item back to Base from the Base chip, out of every overlay', async () => {
    const { ctx, itemId, overlayId } = await withOverlay();
    await setItemInOverlay(ctx, { missionId: M, itemId, overlayId, inOverlay: true });
    await renderWithProviders(<ItemOverlaysSection missionId={M} itemId={itemId} />, ctx);
    await fireEvent.press(await screen.findByLabelText('Move to Base'));
    await waitFor(async () => expect(await firstValueFrom(observeItemOverlayIds(ctx.db, itemId))).toEqual([]));
    expect(await screen.findByLabelText('In Base')).toBeSelected();
  });
});

describe('adding an item', () => {
  async function openAdd(ctx: ReturnType<typeof makeTestContext>) {
    useDraft.setState(INITIAL_DRAFT);
    useInteraction.setState(INITIAL_INTERACTION);
    useInteraction.getState().setCamera({ center: at, zoom: 14, bearing: 0 });
    useMenu.getState().openMenu('point.add', {});
    await renderWithProviders(<AddPointMenu params={{}} missionId={M} />, ctx);
    await screen.findByDisplayValue('CP-1');
  }

  it('offers no overlays until the mission has some', async () => {
    await openAdd(makeTestContext());
    expect(screen.queryByTestId('item-overlays')).toBeNull();
  });

  it('puts the new item in the overlays chosen before Add', async () => {
    const ctx = makeTestContext();
    const p1 = await createOverlay(ctx, { missionId: M, name: 'Phase 1' });
    const p2 = await createOverlay(ctx, { missionId: M, name: 'Phase 2' });
    if (!p1.ok || !p2.ok) throw new Error('setup');
    await openAdd(ctx);
    expect(await screen.findByLabelText('In Base')).toBeSelected();
    expect(screen.getByTestId('item-overlays-hint')).toHaveTextContent(/will be in Base/);
    await fireEvent.press(screen.getByLabelText('Add to Phase 1'));
    await fireEvent.press(screen.getByLabelText('Add to Phase 2'));
    await fireEvent.press(screen.getByLabelText('Take out of Phase 2'));
    expect(screen.getByTestId('item-overlays-hint')).toHaveTextContent(/will be in Phase 1\./);
    await fireEvent.press(screen.getByLabelText('Add'));
    const [item] = await waitFor(async () => {
      const list = await firstValueFrom(observeMissionItems(ctx.db, M));
      expect(list).toHaveLength(1);
      return list;
    });
    await waitFor(async () => expect(await firstValueFrom(observeItemOverlayIds(ctx.db, item.id))).toEqual([p1.value.id]));
  });

  it('adds the item to Base when Base is chosen again', async () => {
    const ctx = makeTestContext();
    await createOverlay(ctx, { missionId: M, name: 'Phase 1' });
    await openAdd(ctx);
    await fireEvent.press(await screen.findByLabelText('Add to Phase 1'));
    await fireEvent.press(screen.getByLabelText('Move to Base'));
    expect(screen.getByLabelText('In Base')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await firstValueFrom(observeMissionItems(ctx.db, M))).toHaveLength(1));
    expect(await ctx.db.getAll('SELECT id FROM map_item_overlays')).toEqual([]);
  });
});

describe('the item hint', () => {
  it('says which overlays the item is in, and when that puts it on the map', () => {
    expect(itemOverlaysHint([])).toBe('This item is in Base. It shows on the map while Base is turned on. Tap another overlay to move it there.');
    expect(itemOverlaysHint(['Phase 1'])).toBe('This item is in Phase 1. It shows on the map while Phase 1 is turned on.');
    expect(itemOverlaysHint(['Phase 1', 'Phase 2', 'Fires'])).toBe('This item is in Phase 1, Phase 2 and Fires. It shows on the map while any one of them is turned on.');
  });

  it('speaks of the future while adding', () => {
    expect(itemOverlaysHint([], { adding: true })).toBe('This item will be in Base. It shows on the map while Base is turned on. Tap another overlay to put it there instead.');
    expect(itemOverlaysHint(['Phase 1'], { adding: true })).toBe('This item will be in Phase 1. It shows on the map while Phase 1 is turned on.');
  });

  it('warns when every overlay the item is in is turned off', () => {
    expect(itemOverlaysHint([], { allOff: true })).toMatch(/Base is turned off right now, so the item won't show until you turn it on\.$/);
    expect(itemOverlaysHint(['Phase 2'], { adding: true, allOff: true })).toMatch(/Phase 2 is turned off right now, so the item won't show until you turn it on\.$/);
    expect(itemOverlaysHint(['Phase 1', 'Phase 2'], { allOff: true })).toMatch(/They are all turned off right now, so the item won't show until you turn one on\.$/);
  });
});

describe('on the map', () => {
  it('leaves out an item once every overlay it is in is hidden', async () => {
    const { ctx, itemId, overlayId } = await withOverlay();
    await setItemInOverlay(ctx, { missionId: M, itemId, overlayId, inOverlay: true });
    await renderWithProviders(<PointsLayer missionId={M} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(props.SymbolLayer['points-symbols'].filter).toEqual(hiddenFilter([])));
    await act(async () => void (await setOverlayHidden(ctx, overlayId, true)));
    await waitFor(() => expect(props.SymbolLayer['points-symbols'].filter).toEqual(hiddenFilter([itemId])));
  });
});
