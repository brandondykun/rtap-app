import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { MenuHost } from '@/features/menus/MenuHost';
import { composeSidc } from '@/features/symbology/presets';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { deleteItem, placePoint } from '../commands';
import { pointCoord } from '../geometry';
import { findItem, observeHiddenItemIds } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const AT = { lat: 38.8977, lon: -77.0365 };
const OTHER = { lat: 38.95, lon: -77.1 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useToast.setState({ toast: null });
});

async function openEditor() {
  const ctx = makeTestContext();
  const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2', notes: 'hull down' });
  if (!r.ok) throw new Error('setup');
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('point.edit', { itemId: r.value.id }));
  await screen.findByDisplayValue('FRD-2');
  return { ctx, id: r.value.id };
}

describe('EditPointMenu', () => {
  it('opens prefilled from the item', async () => {
    await openEditor();
    expect(screen.getByRole('header')).toHaveTextContent('Edit point');
    expect(screen.getByLabelText('Friendly')).toBeSelected();
    expect(screen.getByLabelText('Unit type: Armor')).toBeTruthy();
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(AT).northing);
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', notes: 'hull down' });
  });

  it('saves name and position, then closes', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    const item = await findItem(ctx.db, id);
    expect(item?.name).toBe('OBJ IRON');
    expect(pointCoord(item!.geometry)?.lat).toBeCloseTo(OTHER.lat, 3);
  });

  it('hides the item without closing', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent(screen.getByLabelText('Hidden on map'), 'valueChange', true);
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([id]));
    expect(screen.getByTestId('menu-panel')).toBeTruthy();
  });

  it('deletes after a second tap, without a "missing" message', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByText('Delete point'));
    expect(await findItem(ctx.db, id)).not.toBeNull();
    await fireEvent.press(screen.getByText('Tap again to delete'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(await findItem(ctx.db, id)).toBeNull();
    expect(useToast.getState().toast).toBeNull();
  });

  it('closes with a message when the item is deleted elsewhere', async () => {
    const { ctx, id } = await openEditor();
    await act(async () => {
      await deleteItem(ctx, id);
    });
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(useToast.getState().toast?.message).toBe('That point no longer exists.');
  });

  it('closes with a message, writing nothing, when the stored geometry is unreadable', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2' });
    if (!r.ok) throw new Error('setup');
    await ctx.db.write(async () => {
      const record = await ctx.db.get<MapItem>(Tables.mapItems).find(r.value.id);
      await record.update((m) => {
        m.geometry = 'not geojson';
      });
    });
    const before = await findItem(ctx.db, r.value.id);

    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('point.edit', { itemId: r.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(useToast.getState().toast?.message).toBe('That point no longer exists.');
    expect(useDraft.getState().mode).toBeNull();
    expect(await findItem(ctx.db, r.value.id)).toEqual(before);
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]);
  });

  it('closes with a message for an unknown item', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('point.edit', { itemId: 'nope' }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(useToast.getState().toast?.message).toBe('That point no longer exists.');
    expect(useDraft.getState().mode).toBeNull();
  });

  it('switches to another point when a second one is tapped', async () => {
    const { ctx } = await openEditor();
    const b = await placePoint(ctx, { missionId: 'm1', coord: OTHER, sidc: composeSidc('hostile', 'infantry'), name: 'HOS-9' });
    if (!b.ok) throw new Error('setup');
    await act(async () => useMenu.getState().openMenu('point.edit', { itemId: b.value.id }));
    await screen.findByDisplayValue('HOS-9');
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', itemId: b.value.id });
  });
});
