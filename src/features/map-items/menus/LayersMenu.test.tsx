import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { firstValueFrom } from 'rxjs';

import { MenuHost } from '@/features/menus/MenuHost';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_LAYERS_VIEW, useLayersView } from '@/stores/layers-view';
import { INITIAL_MENU, topMenu, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { themeColors } from '@/theme/tokens';
import { renderWithProviders } from '@/test-utils/render';

import { composeSidc } from '@/features/symbology/presets';
import { deleteItem, placeLine, placePoint, placePolygon, setItemHidden } from '../commands';
import { observeHiddenItemIds, observeRingItemIds } from '../repository';
import { openItemMenu } from './item-menus';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const colors = themeColors('dark');
const at = { lat: 38.8977, lon: -77.0365 };
const HOS = 'SHGPUCI--------';

beforeEach(() => {
  useMenu.setState(INITIAL_MENU);
  useDraft.setState(INITIAL_DRAFT);
  useSettings.setState(DEFAULT_SETTINGS);
  useLayersView.setState(INITIAL_LAYERS_VIEW);
});

async function openLayers(ctx = makeTestContext()) {
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('layers', {}));
  await screen.findByText('Layers');
  return ctx;
}

async function openSearch() {
  await fireEvent.press(screen.getByLabelText('Open search'));
  return screen.getByLabelText('Search');
}

describe('LayersMenu', () => {
  it('has no basemap choice (it is in Settings)', async () => {
    await openLayers();
    expect(screen.queryByText('Basemap')).toBeNull();
    expect(screen.queryByLabelText('Topo')).toBeNull();
  });

  it('explains an empty mission', async () => {
    await openLayers();
    expect(screen.getByLabelText('Units')).toBeSelected();
    expect(screen.getByText('No units yet. Use UNIT or long-press the map.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Lines'));
    expect(screen.getByText('No lines yet. Use LINE to draw one.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Polygons'));
    expect(screen.getByText('No polygons yet. Use POLYGON to draw one.')).toBeTruthy();
    expect(screen.queryByLabelText('Show all')).toBeNull();
    expect(screen.queryByLabelText('Hide all')).toBeNull();
  });

  it('puts each tab on one line, with Polygons shortened to Polys', async () => {
    await openLayers();
    expect(screen.getByTestId('layers-tab-unit')).toHaveTextContent(/^Units0$/);
    expect(screen.getByTestId('layers-tab-polygon')).toHaveTextContent(/^Polys0$/);
  });

  it('hides search until the header button opens it, focused; the button again clears and hides it', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-2' });
    await openLayers(ctx);
    await screen.findByText('HOS-1');
    expect(screen.queryByLabelText('Search')).toBeNull();
    const field = await openSearch();
    expect(field).toHaveProp('autoFocus', true);
    await fireEvent.changeText(field, 'HOS-1');
    expect(screen.queryByText('HOS-2')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Close search'));
    expect(screen.queryByLabelText('Search')).toBeNull();
    expect(screen.getByText('HOS-2')).toBeTruthy();
    // Opening it again starts empty.
    expect(await openSearch()).toHaveProp('value', '');
  });

  it('has no search button while the tab is empty', async () => {
    await openLayers();
    expect(screen.queryByLabelText('Open search')).toBeNull();
  });

  it('caps a tab count at 99+', async () => {
    const ctx = makeTestContext();
    for (let i = 1; i <= 99; i++) await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: `P-${i}` });
    await openLayers(ctx);
    await waitFor(() => expect(screen.getByTestId('layers-tab-unit')).toHaveTextContent(/^Units99$/));
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'P-100' });
    await waitFor(() => expect(screen.getByTestId('layers-tab-unit')).toHaveTextContent(/^Units99\+$/));
  });

  it('counts the items in the list, and the matches while searching', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-2' });
    await openLayers(ctx);
    expect(await screen.findByTestId('layers-count')).toHaveTextContent('2 units');
    await fireEvent.changeText(await openSearch(), 'HOS-1');
    expect(screen.getByTestId('layers-count')).toHaveTextContent('1 of 2 units');
    await fireEvent.press(screen.getByLabelText('Clear Search'));
    expect(screen.getByTestId('layers-count')).toHaveTextContent('2 units');
  });

  it('hides all items in the open tab only', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
    const b = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-2' });
    const l = await placeLine(ctx, { missionId: 'm1', points: [at, { lat: at.lat + 0.01, lon: at.lon }], lineType: 'phase-line', name: 'RED' });
    if (!a.ok || !b.ok || !l.ok) throw new Error('setup');
    await openLayers(ctx);
    expect(await screen.findByText('HOS-1')).toBeTruthy();
    // Everything showing: the eye header hides everything.
    expect(screen.queryByLabelText('Show all')).toBeNull();
    expect(screen.getByLabelText('Hide all')).toHaveTextContent(/2\/2/);
    await fireEvent.press(screen.getByLabelText('Hide all'));
    await waitFor(async () => expect((await firstValueFrom(observeHiddenItemIds(ctx.db))).sort()).toEqual([a.value.id, b.value.id].sort()));
    // Now something is hidden: the same header shows everything.
    await waitFor(() => expect(screen.getByLabelText('Show all')).toHaveTextContent(/0\/2/));
    expect(screen.queryByLabelText('Hide all')).toBeNull();
  });

  it('lists points, hides and shows them, and shows all', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
    const b = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-2' });
    await placePoint(ctx, { missionId: 'other', coord: at, sidc: HOS, name: 'ELSEWHERE' });
    if (!a.ok || !b.ok) throw new Error('setup');
    await setItemHidden(ctx, b.value.id, true);
    await openLayers(ctx);

    // One of two hidden: the header counts what is visible, and a tap shows everything.
    expect(await screen.findByLabelText('Show all')).toHaveTextContent(/1\/2/);
    expect(screen.getByTestId('layers-tab-unit')).toHaveTextContent(/^Units2$/);
    expect(screen.queryByText('ELSEWHERE')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Hide HOS-1'));
    await waitFor(async () => expect((await firstValueFrom(observeHiddenItemIds(ctx.db))).sort()).toEqual([a.value.id, b.value.id].sort()));
    await waitFor(() => expect(screen.getByLabelText('Show all')).toHaveTextContent(/0\/2/));

    await fireEvent.press(screen.getByLabelText('Show all'));
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]));
    await waitFor(() => expect(screen.getByLabelText('Hide all')).toHaveTextContent(/2\/2/));
  });

  it('searches and caps long lists', async () => {
    const ctx = makeTestContext();
    for (let i = 1; i <= 105; i++) await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: `P-${i}` });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'OBJ IRON' });
    await openLayers(ctx);
    expect(await screen.findByTestId('layers-more')).toHaveTextContent('Showing 100 of 106 — refine your search');
    await fireEvent.changeText(await openSearch(), 'iron');
    expect(await screen.findByText('OBJ IRON')).toBeTruthy();
    expect(screen.queryByTestId('layers-more')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search'), 'zzz');
    expect(screen.getByText('Nothing matches.')).toBeTruthy();
  });

  it('opens a point when its row is tapped, even a hidden one', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
    if (!a.ok) throw new Error('setup');
    await setItemHidden(ctx, a.value.id, true);
    await openLayers(ctx);
    await fireEvent.press(await screen.findByLabelText('HOS-1'));
    expect(topMenu(useMenu.getState())).toEqual({ id: 'unit.edit', params: { itemId: a.value.id } });
    expect(await screen.findByLabelText('Edit')).toBeTruthy();
  });


  it('shows a line row with its type and length, and opens the line when tapped', async () => {
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', points: [{ lat: 38.9, lon: -77 }, { lat: 38.91, lon: -77 }], lineType: 'phase-line', name: 'RED' });
    if (!r.ok) throw new Error('setup');
    await openLayers(ctx);
    // The first tab with items opens.
    expect(await screen.findByText('RED')).toBeTruthy();
    expect(screen.getByLabelText('Lines')).toBeSelected();
    expect(screen.getByText('Phase line · 1.11 km')).toBeTruthy();
    await fireEvent.press(screen.getByText('RED'));
    await waitFor(() => expect(topMenu(useMenu.getState())).toEqual({ id: 'line.edit', params: { itemId: r.value.id } }));
  });

  it('shows a polygon row with its type and radius, and opens the polygon when tapped', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: 'NORTH', shape: { kind: 'circle', center: at, radiusM: 500 } });
    if (!r.ok) throw new Error('setup');
    await openLayers(ctx);
    expect(await screen.findByText('NORTH')).toBeTruthy();
    expect(screen.getByLabelText('Polygons')).toBeSelected();
    expect(screen.getByText('No fire area · r 500 m')).toBeTruthy();
    await fireEvent.press(screen.getByText('NORTH'));
    await waitFor(() => expect(topMenu(useMenu.getState())).toEqual({ id: 'polygon.edit', params: { itemId: r.value.id } }));
  });

  it('keeps each category in its own tab, with search and Show all scoped to it, and remembers the tab', async () => {
    const ctx = makeTestContext();
    const u = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
    const l = await placeLine(ctx, { missionId: 'm1', points: [at, { lat: at.lat + 0.01, lon: at.lon }], lineType: 'phase-line', name: 'RED' });
    if (!u.ok || !l.ok) throw new Error('setup');
    await setItemHidden(ctx, u.value.id, true);
    await setItemHidden(ctx, l.value.id, true);
    await openLayers(ctx);
    expect(await screen.findByText('HOS-1')).toBeTruthy();
    expect(screen.queryByText('RED')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Lines'));
    expect(screen.getByText('RED')).toBeTruthy();
    expect(screen.queryByText('HOS-1')).toBeNull();
    expect(await openSearch()).toHaveProp('placeholder', 'Search lines');
    await fireEvent.press(screen.getByLabelText('Show all'));
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([u.value.id]));
    await act(async () => useMenu.getState().closeMenu());
    await act(async () => useMenu.getState().openMenu('layers', {}));
    expect(await screen.findByText('RED')).toBeTruthy();
    expect(screen.getByLabelText('Lines')).toBeSelected();
  });

  describe('drilling into an item', () => {
    async function drillIn() {
      const ctx = makeTestContext();
      const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
      const b = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-2' });
      if (!a.ok || !b.ok) throw new Error('setup');
      await openLayers(ctx);
      await screen.findByText('HOS-1');
      await fireEvent.changeText(await openSearch(), 'HOS');
      await fireEvent.scroll(screen.getByTestId('menu-panel-scroll'), { nativeEvent: { contentOffset: { x: 0, y: 180 } } });
      await fireEvent.press(await screen.findByLabelText('HOS-1'));
      await screen.findByLabelText('Edit');
      return { ctx, id: a.value.id };
    }

    it('opens the item over Layers, with Back instead of Close', async () => {
      await drillIn();
      expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['layers', 'unit.edit']);
      expect(screen.getByLabelText('Back')).toBeTruthy();
      expect(screen.queryByLabelText('Close')).toBeNull();
    });

    it('goes Back to Layers as it was left: same tab, search text and scroll position', async () => {
      jest.mocked(ScrollView.prototype.scrollTo).mockClear();
      await drillIn();
      await fireEvent.press(screen.getByLabelText('Back'));
      expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['layers']);
      expect(await screen.findByDisplayValue('HOS')).toBeTruthy();
      expect(screen.getByLabelText('Units')).toBeSelected();
      const scrollView = screen.getByTestId('menu-panel-scroll');
      await fireEvent(scrollView, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 400 } } });
      await fireEvent(scrollView, 'contentSizeChange', 390, 1000);
      expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith({ y: 180, animated: false });
    });

    it('returns to Layers after deleting the item, or when it no longer exists', async () => {
      const { ctx, id } = await drillIn();
      await act(async () => {
        await deleteItem(ctx, id);
      });
      await waitFor(() => expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['layers']));
      expect(await screen.findByText('HOS-2')).toBeTruthy();
      expect(screen.queryByText('HOS-1')).toBeNull();
    });

    it('still opens an item tapped on the map in its place, with Close', async () => {
      const ctx = makeTestContext();
      const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
      if (!a.ok) throw new Error('setup');
      await openLayers(ctx);
      // What a map tap does.
      await act(async () => openItemMenu(a.value.id, { kind: 'point', sidc: HOS }));
      await screen.findByLabelText('Edit');
      expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['unit.edit']);
      expect(screen.getByLabelText('Close')).toBeTruthy();
      expect(screen.queryByLabelText('Back')).toBeNull();
    });
  });

  describe('range rings', () => {
    async function twoGuns() {
      const ctx = makeTestContext();
      const sidc = composeSidc('hostile', 'artillery');
      const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc, name: 'ART-1', ranges: { threatRangeM: 9000 } });
      const b = await placePoint(ctx, { missionId: 'm1', coord: at, sidc, name: 'GUN-2', ranges: { threatRangeM: 9000 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      await openLayers(ctx);
      await screen.findByText('ART-1');
      return { ctx, ids: [a.value.id, b.value.id].sort() };
    }

    it('the ring header shows every ring while any is off (even while searching), then hides them all', async () => {
      const { ctx, ids } = await twoGuns();
      expect(screen.queryByLabelText('Hide all rings')).toBeNull();
      expect(screen.getByLabelText('Show all rings')).toHaveTextContent(/0\/2/);
      await fireEvent.press(screen.getByLabelText('Show ring for ART-1'));
      await waitFor(() => expect(screen.getByLabelText('Show all rings')).toHaveTextContent(/1\/2/));
      await fireEvent.changeText(await openSearch(), 'art-1');
      await fireEvent.press(screen.getByLabelText('Show all rings'));
      await waitFor(async () => expect((await firstValueFrom(observeRingItemIds(ctx.db))).sort()).toEqual(ids));
      await waitFor(() => expect(screen.getByLabelText('Hide all rings')).toHaveTextContent(/2\/2/));
      await fireEvent.press(screen.getByLabelText('Hide all rings'));
      await waitFor(async () => expect(await firstValueFrom(observeRingItemIds(ctx.db))).toEqual([]));
    });

    it('keeps the ring column aligned: units without a ring get an empty slot', async () => {
      const ctx = makeTestContext();
      await placePoint(ctx, { missionId: 'm1', coord: at, sidc: composeSidc('hostile', 'artillery'), name: 'ART-1', ranges: { threatRangeM: 9000 } });
      await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
      await openLayers(ctx);
      await screen.findByText('HOS-1');
      expect(screen.getAllByTestId('list-column-empty')).toHaveLength(1);
    });

    it('has no ring column when no unit has a ring distance', async () => {
      const ctx = makeTestContext();
      await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
      await openLayers(ctx);
      await screen.findByText('HOS-1');
      expect(screen.queryByLabelText('Show all rings')).toBeNull();
      expect(screen.queryByTestId('list-column-empty')).toBeNull();
    });

    it('the row button toggles one ring', async () => {
      const { ctx } = await twoGuns();
      await fireEvent.press(screen.getByLabelText('Show ring for ART-1'));
      await waitFor(async () => expect(await firstValueFrom(observeRingItemIds(ctx.db))).toHaveLength(1));
      expect(await screen.findByLabelText('Hide ring for ART-1')).toBeTruthy();
      expect(screen.getByLabelText('Show ring for GUN-2')).toBeTruthy();
    });

    it('draws the ring button in the accent color only while the ring is on', async () => {
      await twoGuns();
      const icon = (label: string) => within(screen.getByLabelText(label)).getByText(/./);
      expect(icon('Show ring for ART-1')).toHaveStyle({ color: colors['text-muted'] });
      await fireEvent.press(screen.getByLabelText('Show ring for ART-1'));
      await screen.findByLabelText('Hide ring for ART-1');
      expect(icon('Hide ring for ART-1')).toHaveStyle({ color: colors.accent });
    });

    it('has no ring buttons on the Points tab', async () => {
      await twoGuns();
      await fireEvent.press(screen.getByLabelText('Points'));
      expect(screen.queryByLabelText('Show all rings')).toBeNull();
      expect(screen.queryByLabelText('Hide all rings')).toBeNull();
    });
  });
});
