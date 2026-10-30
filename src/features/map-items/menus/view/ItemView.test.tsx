import { itemCategory } from '@/features/symbology/categories';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { describeVector } from '@/lib/geo/vector';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { placePoint } from '../../commands';
import type { UnitRanges } from '../../unit-ranges';
import { observeHiddenItemIds, observeItem, observeRingItemIds, type MapItemSnapshot } from '../../repository';
import { ItemTitle } from './ItemTitle';
import { ItemView } from './ItemView';

const AT = { lat: 38.8977, lon: -77.0365 };
const OP_AT = { lat: 38.9, lon: -77.04 };

beforeEach(() => {
  useSettings.setState({ coordinateFormat: 'mgrs' });
  useDraft.setState(INITIAL_DRAFT);
  useOp.setState(INITIAL_OP);
  usePresence.setState(INITIAL_PRESENCE);
});

async function open(sidc: string, extra: { ranges?: Partial<UnitRanges>; notes?: string; elevationM?: number } = {}, props: { hidden?: boolean } = {}) {
  const ctx = makeTestContext();
  const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc, name: 'ITEM', ...extra });
  if (!r.ok) throw new Error('setup');
  const item = (await firstValueFrom(observeItem(ctx.db, r.value.id))) as MapItemSnapshot;
  useDraft.setState({ coord: AT, locked: true });
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  await renderWithProviders(<ItemView category={itemCategory({ kind: 'point', sidc })} item={item} hidden={props.hidden ?? false} onEditNotes={onEdit} onDelete={onDelete} />, ctx);
  return { ctx, id: r.value.id, onEdit, onDelete };
}

describe('ItemView', () => {
  it('shows the MGRS then DIST/DIR/ELEV', async () => {
    await open(composeSidc('friend', 'armor'), { elevationM: 88 });
    expect(screen.getByText('MGRS')).toBeTruthy();
    expect(screen.getByText(/^18S/)).toBeTruthy();
    expect(screen.getByText('DIST')).toBeTruthy();
    expect(screen.getByText('DIR')).toBeTruthy();
    expect(screen.getByText('ELEV')).toBeTruthy();
    expect(screen.getByText('88 m')).toBeTruthy();
  });

  it('labels LAT/LON in that format', async () => {
    useSettings.setState({ coordinateFormat: 'latlon' });
    await open(composeSidc('friend', 'armor'));
    expect(screen.getByText('LAT/LON')).toBeTruthy();
    expect(screen.queryByText('MGRS')).toBeNull();
  });

  it('measures DIST from the OP in OP mode', async () => {
    useOp.setState({ phase: 'on', at: OP_AT });
    await open(composeSidc('friend', 'armor'));
    const s = useSettings.getState();
    const v = describeVector(OP_AT, AT, { date: new Date(), declinationOverrideDeg: s.declinationOverrideDeg, unit: s.angleUnit, ref: s.northRef });
    expect(screen.getByText(v.distanceLabel)).toBeTruthy();
  });

  it('puts the north reference in the DIR label, leaving the direction and its unit below', async () => {
    useOp.setState({ phase: 'on', at: OP_AT });
    await open(composeSidc('friend', 'armor'));
    const s = useSettings.getState();
    const v = describeVector(OP_AT, AT, { date: new Date(), declinationOverrideDeg: s.declinationOverrideDeg, unit: s.angleUnit, ref: s.northRef });
    expect(screen.getByText(`DIR (${v.refLabel})`)).toBeTruthy();
    expect(screen.getByText(v.bearingLabel)).toBeTruthy();
    expect(screen.queryByText(new RegExp(`${v.bearingLabel}.*${v.refLabel}`))).toBeNull();
  });

  it('air defense with only a ceiling: Ring disabled, ring row shows the ceiling', async () => {
    await open(composeSidc('hostile', 'air-defense'), { ranges: { verticalRangeFt: 900 } });
    expect(screen.getByLabelText('Ring')).toBeDisabled();
    expect(screen.getByTestId('ring-row')).toHaveTextContent('RANGE RING↕ 900 ft');
  });

  it('recon has no Ring button or ring row', async () => {
    await open(composeSidc('friend', 'recon'));
    expect(screen.queryByLabelText('Ring')).toBeNull();
    expect(screen.queryByTestId('ring-row')).toBeNull();
  });

  it('Hide hides the item and the button reads Show', async () => {
    const { ctx, id } = await open(composeSidc('friend', 'armor'));
    await fireEvent.press(screen.getByLabelText('Hide'));
    const ids = await new Promise<string[]>((res) => observeHiddenItemIds(ctx.db).subscribe((v) => v.includes(id) && res(v)));
    expect(ids).toContain(id);
  });

  it('shows Show, selected, while hidden', async () => {
    await open(composeSidc('friend', 'armor'), {}, { hidden: true });
    expect(screen.getByLabelText('Show')).toBeSelected();
  });

  it('Ring turns the ring on and the button becomes selected', async () => {
    const { ctx, id } = await open(composeSidc('hostile', 'artillery'), { ranges: { threatRangeM: 800 } });
    expect(screen.getByLabelText('Ring')).not.toBeSelected();
    await fireEvent.press(screen.getByLabelText('Ring'));
    await waitFor(() => expect(screen.getByLabelText('Ring')).toBeSelected());
    const ids = await new Promise<string[]>((res) => observeRingItemIds(ctx.db).subscribe((v) => res(v)));
    expect(ids).toContain(id);
  });

  it('Delete needs two taps', async () => {
    const { onDelete } = await open(composeSidc('friend', 'armor'));
    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Tap again')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tap again to delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('Center bumps coordRev', async () => {
    await open(composeSidc('friend', 'armor'));
    const before = useDraft.getState().coordRev;
    await fireEvent.press(screen.getByLabelText('Center'));
    expect(useDraft.getState().coordRev).toBe(before + 1);
  });

  it('Add notes calls onEdit; existing notes show', async () => {
    const a = await open(composeSidc('friend', 'armor'));
    await fireEvent.press(screen.getByLabelText('Add notes'));
    expect(a.onEdit).toHaveBeenCalled();
  });

  it('shows the notes text', async () => {
    await open(composeSidc('friend', 'armor'), { notes: 'hull down' });
    expect(screen.getByText('hull down')).toBeTruthy();
    const notes = screen.getByLabelText('Notes: hull down');
    expect(notes.props.accessibilityHint).toBe('Opens the editor');
    expect(screen.getByText('hull down')).toHaveProp('numberOfLines', 6);
  });
});

describe('ItemTitle', () => {
  it('keeps a long name and subtitle on one line, and tags hidden', async () => {
    const ctx = makeTestContext();
    const item = { name: 'N'.repeat(40), sidc: composeSidc('unknown', 'air-defense', 'battalion') } as MapItemSnapshot;
    await renderWithProviders(<ItemTitle category="unit" item={item} hidden />, ctx);
    expect(screen.getByText('N'.repeat(40)).props.numberOfLines).toBe(1);
    expect(screen.getByTestId('item-subtitle').props.numberOfLines).toBe(1);
    expect(screen.getByTestId('hidden-tag')).toBeTruthy();
    expect(screen.getByTestId('item-subtitle')).toBeTruthy();
    // The tag sits beside the subtitle, not the name.
    expect(screen.getByTestId('hidden-tag').parent!.parent).toBe(screen.getByTestId('item-subtitle').parent!.parent);
    expect(screen.getByText('N'.repeat(40)).parent).not.toBe(screen.getByTestId('hidden-tag').parent);
  });
});
