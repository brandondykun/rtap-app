import { fireEvent, screen } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { placePolygon } from '../../commands';
import { observeItem, type MapItemSnapshot } from '../../repository';
import { PolygonView } from './PolygonView';

const C = { lat: 38.9, lon: -77 };
const SQUARE = [C, { lat: 38.91, lon: -77 }, { lat: 38.91, lon: -76.99 }, { lat: 38.9, lon: -76.99 }];

beforeEach(() => {
  useSettings.setState({ coordinateFormat: 'mgrs', showLineDistances: true });
  useDraft.setState(INITIAL_DRAFT);
  useOp.setState(INITIAL_OP);
  usePresence.setState(INITIAL_PRESENCE);
});

async function open(shape: Parameters<typeof placePolygon>[1]['shape'], props: { hidden?: boolean; notes?: string } = {}) {
  const ctx = makeTestContext();
  const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: 'OBJ-1', notes: props.notes, shape });
  if (!r.ok) throw new Error('setup');
  const item = (await firstValueFrom(observeItem(ctx.db, r.value.id))) as MapItemSnapshot;
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  await renderWithProviders(<PolygonView item={item} hidden={props.hidden ?? false} onEditNotes={onEdit} onDelete={onDelete} />, ctx);
  return { item, onEdit, onDelete };
}

describe('PolygonView', () => {
  it('shows identity, card, tiles and a collapsed points row for a points polygon', async () => {
    await open({ kind: 'points', points: SQUARE });
    const title = screen.getByTestId('polygon-title');
    expect(title).toHaveTextContent('OBJ-1Objective · 4 points · 15% fill');
    expect(title.props.accessibilityLabel).toBe('OBJ-1, Objective · 4 points · 15% fill');
    for (const t of ['CENTER', 'TO CENTER', 'PERIMETER', 'AREA']) expect(screen.getByText(t)).toBeTruthy();
    for (const t of ['Fit', 'Lengths', 'Hide', 'Delete']) expect(screen.getByLabelText(t)).toBeTruthy();
    expect(screen.getByLabelText('Points, 4')).toBeTruthy();
    expect(screen.queryByLabelText('Point 1')).toBeNull();
  });

  it('expands the points without remove, and pressing one centers the map on it', async () => {
    await open({ kind: 'points', points: SQUARE });
    await fireEvent.press(screen.getByLabelText('Points, 4'));
    for (const n of [1, 2, 3, 4]) expect(screen.getByLabelText(`Point ${n}`)).toBeTruthy();
    expect(screen.queryByLabelText('Remove point 1')).toBeNull();
    expect(screen.getByText('start')).toBeTruthy();
    const rev = useDraft.getState().lookRev;
    await fireEvent.press(screen.getByLabelText('Point 2'));
    expect(useDraft.getState().lookRev).toBe(rev + 1);
    expect(useDraft.getState().lookTarget).toEqual(SQUARE[1]);
    await fireEvent.press(screen.getByLabelText('Points, 4'));
    expect(screen.queryByLabelText('Point 1')).toBeNull();
  });

  it('shows RADIUS and no PERIMETER, Lengths or points row for a circle', async () => {
    await open({ kind: 'circle', center: C, radiusM: 500 });
    expect(screen.getByTestId('polygon-title')).toHaveTextContent('OBJ-1Objective · 15% fill');
    expect(screen.getByText('RADIUS')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
    expect(screen.queryByText('PERIMETER')).toBeNull();
    expect(screen.queryByLabelText('Lengths')).toBeNull();
    expect(screen.queryByLabelText(/^Points/)).toBeNull();
  });

  it('Fit refits the camera on every press', async () => {
    const { item } = await open({ kind: 'points', points: SQUARE });
    useDraft.getState().startEditPolygon({ itemId: item.id, polygonType: 'objective', fill: 'light', shape: { kind: 'points', points: SQUARE }, ring: SQUARE, name: 'OBJ-1', notes: '' });
    const rev = useDraft.getState().focusRev;
    await fireEvent.press(screen.getByLabelText('Fit'));
    await fireEvent.press(screen.getByLabelText('Fit'));
    expect(useDraft.getState().focusRev).toBe(rev + 2);
  });

  it('Lengths toggles the line distances and shows selected while on', async () => {
    await open({ kind: 'points', points: SQUARE });
    expect(screen.getByLabelText('Lengths')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Lengths'));
    expect(useSettings.getState().showLineDistances).toBe(false);
    expect(screen.getByLabelText('Lengths')).not.toBeSelected();
  });

  it('marks a hidden polygon and offers Show', async () => {
    await open({ kind: 'points', points: SQUARE }, { hidden: true });
    expect(screen.getByTestId('hidden-tag')).toBeTruthy();
    expect(screen.getByLabelText('Show')).toBeTruthy();
    expect(screen.queryByLabelText('Hide')).toBeNull();
    expect(screen.getByTestId('polygon-title').props.accessibilityLabel).toBe('OBJ-1, Objective · 4 points · 15% fill, hidden');
  });

  it('reads LAT/LON in that format, in the card and the points list', async () => {
    useSettings.setState({ coordinateFormat: 'latlon' });
    await open({ kind: 'points', points: SQUARE });
    expect(screen.getByText('LAT/LON')).toBeTruthy();
    expect(screen.queryByText('CENTER')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Points, 4'));
    expect(screen.getAllByText(/38\.9/).length).toBeGreaterThan(1);
    expect(screen.queryByText(/^18S/)).toBeNull();
  });

  it('deletes only on the second tap and opens the notes editor', async () => {
    const { onDelete, onEdit } = await open({ kind: 'points', points: SQUARE });
    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Tap again to delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Add notes'));
    expect(onEdit).toHaveBeenCalled();
  });
});
