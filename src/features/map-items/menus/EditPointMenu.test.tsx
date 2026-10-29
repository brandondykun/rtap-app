import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { setElevationSource } from '@/features/map/terrain/elevation';
import { MenuHost } from '@/features/menus/MenuHost';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { placePoint } from '../commands';
import { findItem } from '../repository';

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
  const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: 'GFGPDPO-------X', name: 'OP-1', notes: 'ridge' });
  if (!r.ok) throw new Error('setup');
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('point.edit', { itemId: r.value.id }));
  await screen.findByLabelText('Edit');
  return { ctx, id: r.value.id };
}

describe('EditPointMenu', () => {
  it('opens to the condensed view, then edits the type and saves', async () => {
    const { ctx, id } = await openEditor();
    expect(screen.getByRole('header')).toHaveAccessibleName(/^OP-1, /);
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByLabelText('Hidden on map')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByRole('header')).toHaveTextContent('Edit point');
    await fireEvent.press(screen.getByLabelText('Point type: Observation post'));
    await fireEvent.press(screen.getByText('Rally point'));
    expect(screen.getByDisplayValue('OP-1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByLabelText('Edit')).toBeTruthy());
    expect((await findItem(ctx.db, id))?.sidc).toBe('GFGPGPPR------X');
  });

  it('keeps the stored elevation on a save without a move, and looks it up again after a move', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: 'GFGPDPO-------X', name: 'OP-1', elevationM: 88 });
    if (!r.ok) throw new Error('setup');
    const query = jest.fn(async () => 40);
    setElevationSource(query);
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('point.edit', { itemId: r.value.id }));
    await screen.findByLabelText('Edit');
    expect(screen.getByText('88 m')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OP RIDGE');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByRole('header')).toHaveAccessibleName(/^OP RIDGE, /));
    expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(88);
    expect(query).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Edit'));
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(40));
    await waitFor(() => expect(screen.getByText('40 m')).toBeTruthy());
  });

  it('Cancel returns from the form to the view', async () => {
    await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OP RIDGE');
    await fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByRole('header')).toHaveAccessibleName(/^OP-1, /);
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('deletes from the view after a second tap', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Delete'));
    await fireEvent.press(screen.getByLabelText('Tap again to delete'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(await findItem(ctx.db, id)).toBeNull();
  });

  it('opens a unit in the unit menu instead', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-1' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('point.edit', { itemId: r.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: r.value.id } }]));
  });
});
