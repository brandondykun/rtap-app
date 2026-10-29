import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { setElevationSource } from '@/features/map/terrain/elevation';
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
import { findItem, observeHiddenItemIds, observeRingItemIds } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const AT = { lat: 38.8977, lon: -77.0365 };
const OTHER = { lat: 38.95, lon: -77.1 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useToast.setState({ toast: null });
});

afterEach(() => setElevationSource(null));

async function openEditor() {
  const ctx = makeTestContext();
  const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2', notes: 'hull down' });
  if (!r.ok) throw new Error('setup');
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
  await screen.findByDisplayValue('FRD-2');
  return { ctx, id: r.value.id };
}

describe('EditUnitMenu', () => {
  it('opens the selected point read-only with Close and Edit', async () => {
    await openEditor();
    expect(screen.getByRole('header')).toHaveTextContent('Unit');
    expect(screen.getByText('Close')).toBeTruthy();
    expect(screen.getByLabelText('Edit')).toBeEnabled();
    expect(screen.getByLabelText('Name').props.editable).toBe(false);
    expect(screen.getByLabelText('Northing').props.editable).toBe(false);
    expect(screen.getByLabelText('Hostile')).toBeDisabled();
    expect(screen.getByLabelText('Center')).toBeDisabled();
    expect(screen.getByLabelText('Hidden on map')).toBeEnabled();
    expect(screen.getByLabelText('Delete unit')).toBeDisabled();
    expect(useDraft.getState().locked).toBe(true);
  });

  it('ignores long-press moves while read-only', async () => {
    await openEditor();
    await act(async () => useDraft.getState().setCoord(OTHER, 'press'));
    expect(useDraft.getState().coord).toEqual(AT);
  });

  it('opens prefilled from the item', async () => {
    await openEditor();
    expect(screen.getByLabelText('Friendly')).toBeSelected();
    expect(screen.getByLabelText('Unit type: Armor')).toBeTruthy();
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(AT).northing);
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', notes: 'hull down' });
  });

  it('shows the stored echelon when editing a unit', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'armor', 'battalion'), name: 'HOS-4' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await screen.findByDisplayValue('HOS-4');
    expect(screen.getByLabelText('Echelon: Battalion')).toBeTruthy();
  });

  it('Edit unlocks the form; Save writes and returns to the read-only view', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByRole('header')).toHaveTextContent('Edit unit');
    expect(screen.getByText('Cancel')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByRole('header')).toHaveTextContent('Unit'));
    expect(useMenu.getState().stack).toHaveLength(1);
    expect(screen.getByLabelText('Name').props.editable).toBe(false);
    expect(screen.getByDisplayValue('OBJ IRON')).toBeTruthy();
    const item = await findItem(ctx.db, id);
    expect(item?.name).toBe('OBJ IRON');
    expect(pointCoord(item!.geometry)?.lat).toBeCloseTo(OTHER.lat, 3);
  });

  it('keeps the stored elevation on a save without a move, and looks it up again after a move', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2', elevationM: 88 });
    if (!r.ok) throw new Error('setup');
    const query = jest.fn(async () => 40);
    setElevationSource(query);
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await screen.findByDisplayValue('FRD-2');
    expect(screen.getByLabelText('Elevation 88 m')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByRole('header')).toHaveTextContent('Unit'));
    expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(88);
    expect(query).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Edit'));
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(40));
    expect(screen.getByLabelText('Elevation 40 m')).toBeTruthy();
  });

  it('Save stores the new echelon in the symbol', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.press(screen.getByLabelText('Echelon: Unspecified'));
    await fireEvent.press(screen.getByText('Company'));
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByRole('header')).toHaveTextContent('Unit'));
    expect((await findItem(ctx.db, id))?.sidc).toBe(composeSidc('friend', 'armor', 'company'));
  });

  it('Cancel drops unsaved changes and returns to the read-only view', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByRole('header')).toHaveTextContent('Unit');
    expect(screen.getByDisplayValue('FRD-2')).toBeTruthy();
    expect((await findItem(ctx.db, id))?.name).toBe('FRD-2');
    expect(useMenu.getState().stack).toHaveLength(1);
  });

  it('hides the item without closing', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent(screen.getByLabelText('Hidden on map'), 'valueChange', true);
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([id]));
    expect(screen.getByTestId('menu-panel')).toBeTruthy();
  });

  it('hides the item while the form is still locked', async () => {
    const { ctx, id } = await openEditor();
    expect(useDraft.getState().locked).toBe(true);
    await fireEvent(screen.getByLabelText('Hidden on map'), 'valueChange', true);
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([id]));
  });

  it('shows a ring switch for a unit with a range, and it works while locked', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'artillery'), name: 'HOS-3', ranges: { threatRangeM: 12000 } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await screen.findByDisplayValue('HOS-3');
    expect(screen.getByLabelText('Threat ring')).toHaveDisplayValue('12000');
    expect(screen.getByLabelText('Threat ring').props.editable).toBe(false);
    const toggle = await screen.findByLabelText('Show ring on map');
    expect(toggle.props.value).toBe(false);
    expect(useDraft.getState().locked).toBe(true);
    await fireEvent(toggle, 'valueChange', true);
    await waitFor(async () => expect(await firstValueFrom(observeRingItemIds(ctx.db))).toEqual([r.value.id]));
    await waitFor(() => expect(screen.getByLabelText('Show ring on map').props.value).toBe(true));
  });

  it('shows no ring switch for a unit without a range', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'artillery'), name: 'HOS-3' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await screen.findByDisplayValue('HOS-3');
    expect(screen.getByLabelText('Threat ring')).toBeTruthy();
    expect(screen.queryByLabelText('Show ring on map')).toBeNull();
  });

  it('deletes after a second tap, without a "missing" message', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.press(screen.getByText('Delete unit'));
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
    expect(useToast.getState().toast?.message).toBe('That unit no longer exists.');
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
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(useToast.getState().toast?.message).toBe('That unit no longer exists.');
    expect(useDraft.getState().mode).toBeNull();
    expect(await findItem(ctx.db, r.value.id)).toEqual(before);
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]);
  });

  it('closes with a message for an unknown item', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: 'nope' }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(useToast.getState().toast?.message).toBe('That unit no longer exists.');
    expect(useDraft.getState().mode).toBeNull();
  });

  it('switches to another point when a second one is tapped', async () => {
    const { ctx } = await openEditor();
    const b = await placePoint(ctx, { missionId: 'm1', coord: OTHER, sidc: composeSidc('hostile', 'infantry'), name: 'HOS-9' });
    if (!b.ok) throw new Error('setup');
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: b.value.id }));
    await screen.findByDisplayValue('HOS-9');
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', itemId: b.value.id });
  });

  it('opens a point in the point menu instead', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'point.edit', params: { itemId: r.value.id } }]));
  });
});
