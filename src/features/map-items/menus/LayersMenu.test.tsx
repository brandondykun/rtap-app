import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScrollView, StyleSheet } from 'react-native';
import { firstValueFrom } from 'rxjs';

import type { IconName } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
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
import { BACK_TO_TOP_AFTER } from './LayersMenu';

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
    expect(screen.getByText('No units yet')).toBeTruthy();
    expect(screen.getByText('Units you add to the map\nwill be listed here.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Lines'));
    expect(screen.getByText('No lines yet')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Polygons'));
    expect(screen.getByText('No polygons yet')).toBeTruthy();
    expect(screen.getByText('Polygons you add to the map\nwill be listed here.')).toBeTruthy();
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

  it.each([
    ['Units', 'rhombus-outline'],
    ['Points', 'map-marker-outline'],
    ['Lines', 'vector-polyline'],
    ['Polygons', 'pentagon-outline'],
  ] as const)('shows the %s tool icon, with a plus, on its empty tab', async (tab, icon) => {
    await openLayers();
    await fireEvent.press(screen.getByLabelText(tab));
    const empty = within(screen.getByTestId('layers-empty'));
    // The icon font draws each icon as one character.
    const glyph = (name: IconName) => String.fromCodePoint(Number(MaterialCommunityIcons.getRawGlyphMap()[name]));
    expect(empty.getByTestId('layers-empty-icon')).toHaveTextContent(glyph(icon));
    expect(empty.getByTestId('layers-empty-plus')).toHaveTextContent(glyph('plus'));
  });

  describe('Units filter chips', () => {
    async function openWithUnits() {
      const ctx = makeTestContext();
      const frd = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: composeSidc('friend', 'infantry'), name: 'FRD-1' });
      if (!frd.ok) throw new Error('setup');
      await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
      await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-2' });
      await openLayers(ctx);
      await screen.findByText('HOS-2');
      return { ctx, frdId: frd.value.id };
    }
    const chip = (key: string) => screen.getByTestId(`layers-chip-${key}`);

    it('shows All and one chip per affiliation with its count, All chosen', async () => {
      await openWithUnits();
      expect(chip('all')).toHaveProp('accessibilityLabel', 'All, 3 units');
      expect(chip('friend')).toHaveProp('accessibilityLabel', 'Friendly, 1 unit');
      expect(chip('hostile')).toHaveProp('accessibilityLabel', 'Hostile, 2 units');
      expect(chip('all')).toBeSelected();
      // Nobody neutral or unknown: dimmed, and cannot be chosen.
      expect(chip('neutral')).toBeDisabled();
      expect(chip('unknown')).toBeDisabled();
    });

    it('lists only the chosen affiliation, says how many of all, and narrows show/hide all to it', async () => {
      await openWithUnits();
      await fireEvent.press(chip('hostile'));
      expect(chip('hostile')).toBeSelected();
      expect(screen.queryByText('FRD-1')).toBeNull();
      expect(screen.getByText('HOS-1')).toBeTruthy();
      expect(screen.getByTestId('layers-count')).toHaveTextContent('2 hostile of 3');
      expect(screen.getByLabelText('Hide all')).toBeTruthy();
      await fireEvent.press(chip('all'));
      expect(screen.getByText('FRD-1')).toBeTruthy();
      expect(screen.getByTestId('layers-count')).toHaveTextContent('3 units');
    });

    it('falls back to All once the chosen affiliation has no units left', async () => {
      const { ctx, frdId } = await openWithUnits();
      await fireEvent.press(chip('friend'));
      await act(async () => void (await deleteItem(ctx, frdId)));
      await waitFor(() => expect(chip('all')).toBeSelected());
      expect(screen.getByText('HOS-1')).toBeTruthy();
    });

    it('keeps the list where it was scrolled when the chip changes, and starts it at the top when the tab does', async () => {
      await openWithUnits();
      const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);
      for (const change of [() => fireEvent.press(chip('hostile')), () => fireEvent.press(chip('all'))]) {
        scrollTo.mockClear();
        await change();
        expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ y: 0 }));
      }
      scrollTo.mockClear();
      await fireEvent.press(screen.getByLabelText('Points'));
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ y: 0, animated: false }));
    });

    it('draws a friendly unit grid in the friendly blue, other grids plain (value colors)', async () => {
      await openWithUnits();
      const grids = screen.getAllByText(formatCoordinate(at, 'mgrs'));
      // FRD-1, HOS-1 and HOS-2 all sit at the same spot: only the friendly one is blue.
      expect(grids.filter((g) => String(g.props.className ?? '').includes('text-friendly'))).toHaveLength(1);
    });

    it('is only on the Units tab', async () => {
      await openWithUnits();
      await fireEvent.press(screen.getByLabelText('Points'));
      expect(screen.queryByTestId('layers-unit-filter')).toBeNull();
    });
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

  it('lists every item however many (scrolling, not capped), and searches them', async () => {
    const ctx = makeTestContext();
    for (let i = 1; i <= 105; i++) await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: `P-${i}` });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'OBJ IRON' });
    await openLayers(ctx);
    expect(await screen.findByTestId('layers-count')).toHaveTextContent('106 units');
    // The panel's scroller is the list itself: rows past the first 100 are drawn as they scroll into view.
    expect(screen.queryByTestId('menu-panel-scroll-host')).toBeTruthy();
    expect(screen.queryByText('P-105')).toBeNull();
    await fireEvent.scroll(screen.getByTestId('menu-panel-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y: 106 * 100 }, contentSize: { width: 400, height: 107 * 100 }, layoutMeasurement: { width: 400, height: 900 } },
    });
    expect(await screen.findByText('P-105')).toBeTruthy();
    await fireEvent.changeText(await openSearch(), 'iron');
    expect(await screen.findByText('OBJ IRON')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search'), 'zzz');
    expect(screen.getByText('Nothing matches.')).toBeTruthy();
  });

  it('offers a Back to top button once scrolled well down, which scrolls the list back up', async () => {
    const ctx = makeTestContext();
    for (let i = 1; i <= 30; i++) await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: `P-${i}` });
    await openLayers(ctx);
    await screen.findByTestId('layers-count');
    expect(screen.queryByLabelText('Back to top')).toBeNull();
    const list = screen.getByTestId('menu-panel-scroll');
    const scrollTo = (y: number) =>
      fireEvent.scroll(list, { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 400, height: 3100 }, layoutMeasurement: { width: 400, height: 900 } } });
    await scrollTo(BACK_TO_TOP_AFTER);
    expect(screen.queryByLabelText('Back to top')).toBeNull();
    await scrollTo(BACK_TO_TOP_AFTER + 100);
    // The last row scrolls clear above the button: the list ends with room for it.
    const bottom = (StyleSheet.flatten(list.props.contentContainerStyle) as { paddingBottom: number }).paddingBottom;
    expect(bottom).toBeGreaterThanOrEqual(16 + 40);
    jest.mocked(ScrollView.prototype.scrollTo).mockClear();
    await fireEvent.press(screen.getByLabelText('Back to top'));
    expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ y: 0, animated: true }));
    // Back at the top (the scroll the press started), the button goes.
    await scrollTo(0);
    expect(screen.queryByLabelText('Back to top')).toBeNull();
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

    it('opens the item at its top without the scrolled header line or shadow, however far Layers was scrolled', async () => {
      await drillIn();
      expect(screen.getByTestId('menu-panel-hairline').props.className).toContain('opacity-0');
      expect(StyleSheet.flatten(screen.getByTestId('menu-panel-header').props.style).boxShadow).toBeUndefined();
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
      expect(ScrollView.prototype.scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ y: 180, animated: false }));
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
