import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { MenuHost } from '@/features/menus/MenuHost';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_LAYERS_VIEW, useLayersView } from '@/stores/layers-view';
import { INITIAL_MENU, topMenu, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { placeLine, placePoint, placePolygon, setItemHidden } from '../commands';
import { observeHiddenItemIds } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

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
    expect(screen.getByLabelText('Show all')).toBeDisabled();
  });

  it('lists points, hides and shows them, and shows all', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-1' });
    const b = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'HOS-2' });
    await placePoint(ctx, { missionId: 'other', coord: at, sidc: HOS, name: 'ELSEWHERE' });
    if (!a.ok || !b.ok) throw new Error('setup');
    await setItemHidden(ctx, b.value.id, true);
    await openLayers(ctx);

    expect(await screen.findByTestId('layers-hidden')).toHaveTextContent('1 hidden');
    expect(screen.getByTestId('layers-tab-unit')).toHaveTextContent(/^Units2$/);
    expect(screen.queryByText('ELSEWHERE')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Hide HOS-1'));
    await waitFor(async () => expect((await firstValueFrom(observeHiddenItemIds(ctx.db))).sort()).toEqual([a.value.id, b.value.id].sort()));
    await waitFor(() => expect(screen.getByTestId('layers-hidden')).toHaveTextContent('2 hidden'));

    await fireEvent.press(screen.getByLabelText('Show all'));
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]));
    await waitFor(() => expect(screen.getByTestId('layers-hidden')).toHaveTextContent('0 hidden'));
  });

  it('searches and caps long lists', async () => {
    const ctx = makeTestContext();
    for (let i = 1; i <= 105; i++) await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: `P-${i}` });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'OBJ IRON' });
    await openLayers(ctx);
    expect(await screen.findByTestId('layers-more')).toHaveTextContent('Showing 100 of 106 — refine your search');
    await fireEvent.changeText(screen.getByLabelText('Search'), 'iron');
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
    expect(await screen.findByDisplayValue('HOS-1')).toBeTruthy();
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
    expect(screen.getByLabelText('Search')).toHaveProp('placeholder', 'Search lines…');
    await fireEvent.press(screen.getByLabelText('Show all'));
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([u.value.id]));
    await act(async () => useMenu.getState().closeMenu());
    await act(async () => useMenu.getState().openMenu('layers', {}));
    expect(await screen.findByText('RED')).toBeTruthy();
    expect(screen.getByLabelText('Lines')).toBeSelected();
  });
});
