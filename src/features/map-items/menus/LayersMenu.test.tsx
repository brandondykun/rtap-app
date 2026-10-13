import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { MenuHost } from '@/features/menus/MenuHost';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, topMenu, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { placePoint, setItemHidden } from '../commands';
import { observeHiddenItemIds } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const at = { lat: 38.8977, lon: -77.0365 };
const HOS = 'SHGPUCI--------';

beforeEach(() => {
  useMenu.setState(INITIAL_MENU);
  useDraft.setState(INITIAL_DRAFT);
  useSettings.setState(DEFAULT_SETTINGS);
});

async function openLayers(ctx = makeTestContext()) {
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('layers', {}));
  await screen.findByText('Layers');
  return ctx;
}

describe('LayersMenu', () => {
  it('switches the basemap', async () => {
    await openLayers();
    expect(screen.getByLabelText('Satellite')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Topo'));
    expect(useSettings.getState().basemap).toBe('topo');
  });

  it('explains an empty mission', async () => {
    await openLayers();
    expect(screen.getByText('No points yet. Use POINT or long-press the map.')).toBeTruthy();
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

    expect(await screen.findByText('2 points · 1 hidden')).toBeTruthy();
    expect(screen.queryByText('ELSEWHERE')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Hide HOS-1'));
    await waitFor(async () => expect((await firstValueFrom(observeHiddenItemIds(ctx.db))).sort()).toEqual([a.value.id, b.value.id].sort()));
    expect(await screen.findByText('2 points · 2 hidden')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Show all'));
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]));
    expect(await screen.findByText('2 points · 0 hidden')).toBeTruthy();
  });

  it('searches and caps long lists', async () => {
    const ctx = makeTestContext();
    for (let i = 1; i <= 105; i++) await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: `P-${i}` });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOS, name: 'OBJ IRON' });
    await openLayers(ctx);
    expect(await screen.findByTestId('layers-more')).toHaveTextContent('Showing 100 of 106 — refine your search');
    await fireEvent.changeText(screen.getByLabelText('Search points'), 'iron');
    expect(await screen.findByText('OBJ IRON')).toBeTruthy();
    expect(screen.queryByTestId('layers-more')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search points'), 'zzz');
    expect(screen.getByText('No points match.')).toBeTruthy();
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
});
