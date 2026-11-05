import { TextInput } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { firstValueFrom, NEVER, Subject } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { PanelScrollContext } from '@/components/menu/panel-header-slot';
import { setElevationSource } from '@/features/map/terrain/elevation';
import { MenuHost } from '@/features/menus/MenuHost';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { useToast } from '@/stores/toast';
import { createOverlay } from '@/features/overlays/commands';
import * as overlaysRepository from '@/features/overlays/repository';
import { useKeepOverlaysAtHand } from '@/features/overlays/use-mission-overlays';
import { renderWithProviders } from '@/test-utils/render';

import { deleteItem, placePoint } from '../commands';
import { pointCoord } from '../geometry';
import { EditUnitMenu } from './EditUnitMenu';
import * as repository from '../repository';
import { findItem, observeHiddenItemIds, observeMissionItems, observeRingItemIds, peekMissionItem, type MapItemSnapshot } from '../repository';

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
  await screen.findByLabelText('Edit');
  return { ctx, id: r.value.id };
}

describe('EditUnitMenu', () => {
  it('has its Overlays section from the first frame when the map keeps the overlays at hand', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2' });
    if (!r.ok) throw new Error('setup');
    await createOverlay(ctx, { missionId: 'm1', name: 'Phase 1' });
    function MapScreen() {
      useKeepOverlaysAtHand('m1');
      return <MenuHost landscape={false} missionId="m1" />;
    }
    await renderWithProviders(<MapScreen />, ctx);
    // The map screen has the overlays: an item menu's own overlay query never answering changes nothing.
    await waitFor(async () => expect(await firstValueFrom(overlaysRepository.observeMissionOverlays(ctx.db, 'm1'))).toHaveLength(1));
    const spy = jest.spyOn(overlaysRepository, 'observeMissionOverlays').mockReturnValue(NEVER);
    try {
      await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
      expect(await screen.findByTestId('item-title')).toBeTruthy();
      expect(screen.getByTestId('item-overlays')).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('selecting another unit while one is open shows the new one', async () => {
    const { ctx } = await openEditor();
    const other = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'infantry'), name: 'HOS-9' });
    if (!other.ok) throw new Error('setup');
    // The map's layers keep the mission's items query running, so the new menu starts from the map's copy.
    const map = observeMissionItems(ctx.db, 'm1').subscribe();
    await waitFor(() => expect(peekMissionItem(ctx.db, 'm1', other.value.id)).toBeDefined());
    try {
      await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: other.value.id }));
      expect(await screen.findByTestId('item-title')).toHaveAccessibleName(/^HOS-9, /);
      expect(screen.queryByTestId('item-loading')).toBeNull();
      expect(useDraft.getState()).toMatchObject({ mode: 'edit', itemId: other.value.id });
    } finally {
      map.unsubscribe();
    }
  });

  it('opens straight onto the details when the map already has the unit, with no empty frame', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2' });
    if (!r.ok) throw new Error('setup');
    // The map's layers keep the mission's items query running.
    const map = observeMissionItems(ctx.db, 'm1').subscribe();
    await waitFor(() => expect(peekMissionItem(ctx.db, 'm1', r.value.id)).toBeDefined());
    // The menu's own query has not answered yet: what shows comes from the map's copy.
    jest.spyOn(repository, 'observeItem').mockReturnValue(NEVER);
    try {
      await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
      await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
      expect(screen.getByTestId('item-title')).toHaveAccessibleName(/^FRD-2, /);
      expect(screen.queryByTestId('item-loading')).toBeNull();
    } finally {
      map.unsubscribe();
      jest.mocked(repository.observeItem).mockRestore();
    }
  });

  it('shows it is loading, not an empty menu, while reading a unit the map does not have at hand', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2' });
    if (!r.ok) throw new Error('setup');
    const slow = new Subject<MapItemSnapshot | null>();
    jest.spyOn(repository, 'observeItem').mockReturnValue(slow);
    try {
      await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
      await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
      expect(screen.getByLabelText('Loading the unit')).toBeTruthy();
      expect(screen.queryByTestId('item-title')).toBeNull();
      await act(async () => slow.next((await findItem(ctx.db, r.value.id))!));
      expect(screen.getByTestId('item-title')).toBeTruthy();
      expect(screen.queryByTestId('item-loading')).toBeNull();
    } finally {
      jest.mocked(repository.observeItem).mockRestore();
    }
  });

  it('opens to the condensed view with Close and Edit, not the form', async () => {
    await openEditor();
    expect(screen.getByTestId('item-title')).toHaveAccessibleName(/^FRD-2, Friendly · /);
    expect(screen.getByLabelText('Close')).toBeEnabled();
    expect(screen.getByLabelText('Edit')).toBeEnabled();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByLabelText('Hidden on map')).toBeNull();
    expect(screen.queryByLabelText('Delete unit')).toBeNull();
    expect(screen.getByLabelText('Center')).toBeEnabled();
    expect(screen.getByText('hull down')).toBeTruthy();
    expect(useDraft.getState().locked).toBe(true);
  });

  it('shows Back instead of Close when drilled in from Layers', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('layers', {}));
    await act(async () => useMenu.getState().pushMenu('unit.edit', { itemId: r.value.id }));
    await screen.findByLabelText('Edit');
    expect(screen.getByLabelText('Back')).toBeTruthy();
    expect(screen.queryByLabelText('Close')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(useMenu.getState().stack).toHaveLength(1);
  });

  it('ignores long-press moves while read-only', async () => {
    await openEditor();
    await act(async () => useDraft.getState().setCoord(OTHER, 'press'));
    expect(useDraft.getState().coord).toEqual(AT);
  });

  it('opens prefilled from the item', async () => {
    await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
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
    await fireEvent.press(await screen.findByLabelText('Edit'));
    expect(screen.getByLabelText('Echelon: Battalion')).toBeTruthy();
  });

  it('Edit unlocks the form; Save writes and returns to the read-only view', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByRole('header')).toHaveTextContent('Edit unit');
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.queryByLabelText('Hidden on map')).toBeNull();
    expect(screen.queryByLabelText('Delete unit')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByTestId('item-title')).toHaveAccessibleName(/^OBJ IRON, /));
    expect(useMenu.getState().stack).toHaveLength(1);
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByLabelText('Edit')).toBeTruthy();
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
    await screen.findByLabelText('Edit');
    expect(screen.getByText('88 m')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByLabelText('Edit')).toBeTruthy());
    expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(88);
    expect(query).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Edit'));
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(40));
    await waitFor(() => expect(screen.getByText('40 m')).toBeTruthy());
  });

  it('Save stores the new echelon in the symbol', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.press(screen.getByLabelText('Echelon: Unspecified'));
    await fireEvent.press(screen.getByText('Company'));
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByLabelText('Edit')).toBeTruthy());
    expect((await findItem(ctx.db, id))?.sidc).toBe(composeSidc('friend', 'armor', 'company'));
  });

  it('tapping the notes in the view edits them right there, with Cancel / Save in the header, not the form', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
    try {
      const { ctx, id } = await openEditor();
      await fireEvent.press(screen.getByLabelText('Notes: hull down'));
      // Still the view: its title and actions stay, no other field opens.
      expect(screen.getByRole('header')).toHaveTextContent('Unit');
      expect(screen.getByTestId('item-title')).toBeTruthy();
      expect(screen.queryByLabelText('Name')).toBeNull();
      expect(screen.getByLabelText('Notes')).toHaveProp('value', 'hull down');
      expect(focus).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Cancel')).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Notes'), 'dug in');
      await fireEvent.press(screen.getByLabelText('Save'));
      await waitFor(async () => expect((await findItem(ctx.db, id))?.notes).toBe('dug in'));
      expect(await screen.findByLabelText('Notes: dug in')).toBeTruthy();
      expect(screen.getByLabelText('Edit')).toBeTruthy();
    } finally {
      focus.mockRestore();
    }
  });

  it('Cancel puts back the stored notes and leaves the view as it was', async () => {
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Notes: hull down'));
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'scrap this');
    await fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByLabelText('Notes: hull down')).toBeTruthy();
    expect(useDraft.getState()).toMatchObject({ notes: 'hull down', notesEditing: false, locked: true });
    expect((await findItem(ctx.db, id))?.notes).toBe('hull down');
    expect(useMenu.getState().stack).toHaveLength(1);
    jest.mocked(TextInput.prototype.focus).mockRestore();
  });

  it('jumps back to the top of the menu when Save or Cancel closes the form', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2' });
    if (!r.ok) throw new Error('setup');
    const scrollToTop = jest.fn();
    await renderWithProviders(
      <PanelScrollContext.Provider value={{ scrollToEnd: jest.fn(), scrollToTop, anchorFocus: jest.fn(), scrollFocusedToTop: jest.fn() }}>
        <EditUnitMenu params={{ itemId: r.value.id }} missionId="m1" />
      </PanelScrollContext.Provider>,
      ctx,
    );
    await fireEvent.press(await screen.findByLabelText('Edit'));
    expect(scrollToTop).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(scrollToTop).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'dug in');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(scrollToTop).toHaveBeenCalledTimes(2));
  });

  it('Cancel drops unsaved changes and returns to the read-only view', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByTestId('item-title')).toHaveAccessibleName(/^FRD-2, Friendly · /);
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect((await findItem(ctx.db, id))?.name).toBe('FRD-2');
    expect(useMenu.getState().stack).toHaveLength(1);
  });

  it('hides the item from the view without closing, and the header tags it', async () => {
    const { ctx, id } = await openEditor();
    expect(screen.queryByTestId('hidden-tag')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Hide'));
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([id]));
    await waitFor(() => expect(screen.getByTestId('hidden-tag')).toBeTruthy());
    expect(screen.getByLabelText('Show')).toBeSelected();
    expect(screen.getByTestId('menu-panel')).toBeTruthy();
  });

  it('shows the ring row and a Ring button for a unit with a range, and the button works', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'artillery'), name: 'HOS-3', ranges: { threatRangeM: 12000 } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    const ring = await screen.findByLabelText('Ring');
    expect(ring).not.toBeSelected();
    expect(screen.getByTestId('ring-row')).toBeTruthy();
    expect(useDraft.getState().locked).toBe(true);
    await fireEvent.press(ring);
    await waitFor(async () => expect(await firstValueFrom(observeRingItemIds(ctx.db))).toEqual([r.value.id]));
    await waitFor(() => expect(screen.getByLabelText('Ring')).toBeSelected());
  });

  it('shows Show on map in the ring box while editing, and toggling updates the ring at once', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'artillery'), name: 'HOS-3', ranges: { threatRangeM: 12000 } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await fireEvent.press(await screen.findByLabelText('Edit'));
    const toggle = await within(screen.getByTestId('ring-box')).findByLabelText('Show on map');
    await fireEvent(toggle, 'valueChange', true);
    await waitFor(async () => expect(await firstValueFrom(observeRingItemIds(ctx.db))).toEqual([r.value.id]));
  });

  it('shows no Ring button or ring row for a unit type without a ring', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'infantry'), name: 'HOS-3' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await screen.findByLabelText('Edit');
    expect(screen.queryByLabelText('Ring')).toBeNull();
    expect(screen.queryByTestId('ring-row')).toBeNull();
  });

  it('shows what was stored after Save: a decimal shows rounded in the ring row, a type change clears the old range', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'artillery'), name: 'HOS-3', ranges: { threatRangeM: 18000 } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await fireEvent.press(await screen.findByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Threat range'), '12,6');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByTestId('ring-row')).toHaveTextContent(/13 m/));
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.press(screen.getByLabelText('Unit type: Artillery'));
    await fireEvent.press(screen.getByText('Infantry'));
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByLabelText('Edit')).toBeTruthy());
    expect(screen.queryByTestId('ring-row')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.press(screen.getByLabelText('Unit type: Infantry'));
    await fireEvent.press(screen.getByText('Artillery'));
    expect(screen.getByLabelText('Threat range')).toHaveDisplayValue('');
  });

  it('the form hides the ring switch when the draft unit type has no ring distance', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('hostile', 'artillery'), name: 'HOS-3', ranges: { threatRangeM: 12000 } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await fireEvent.press(await screen.findByLabelText('Edit'));
    await screen.findByLabelText('Show on map');
    await fireEvent.press(screen.getByLabelText('Unit type: Artillery'));
    await fireEvent.press(screen.getByText('Infantry'));
    expect(screen.queryByLabelText('Show on map')).toBeNull();
  });

  it('deletes from the view after a second tap, without a "missing" message', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(await findItem(ctx.db, id)).not.toBeNull();
    await fireEvent.press(screen.getByLabelText('Tap again to delete'));
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
    await ctx.db.execute('UPDATE map_items SET geometry = ? WHERE id = ?', ['not geojson', r.value.id]);
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
    await screen.findByText('HOS-9');
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
