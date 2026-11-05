import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MenuHost } from '@/features/menus/MenuHost';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { placeLine, placePoint } from '../commands';
import { parseLineGeometry } from '../geometry';
import { findItem } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 });

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useToast.setState({ toast: null });
  useSettings.setState(DEFAULT_SETTINGS);
});

async function openEditor(points = [p(0), p(1), p(2)]) {
  const ctx = makeTestContext();
  const r = await placeLine(ctx, { missionId: 'm1', points, lineType: 'phase-line', name: 'RED' });
  if (!r.ok) throw new Error('setup');
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('line.edit', { itemId: r.value.id }));
  await screen.findByTestId('line-title');
  return { ctx, id: r.value.id };
}

describe('EditLineMenu', () => {
  it('opens a line in the condensed view, not the form', async () => {
    await openEditor();
    expect(screen.getByRole('header')).toHaveTextContent('Line');
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.getByTestId('line-title')).toHaveTextContent('REDPhase line · 3 points');
    for (const t of ['Fit', 'Show point distances', 'Hide', 'Delete']) expect(screen.getByLabelText(t)).toBeTruthy();
    expect(screen.getByLabelText('Points, 3')).toBeTruthy();
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('Fit refits the line, and a tapped point in the opened list centers the map on it', async () => {
    await openEditor();
    const focusRev = useDraft.getState().focusRev;
    await fireEvent.press(screen.getByLabelText('Fit'));
    expect(useDraft.getState().focusRev).toBe(focusRev + 1);
    await fireEvent.press(screen.getByLabelText('Points, 3'));
    await fireEvent.press(screen.getByLabelText(/^Point 2,/));
    expect(useDraft.getState().lookTarget).toEqual(p(1));
  });

  it('lists every point of a long line, follows the coordinate format, and closes', async () => {
    await openEditor(Array.from({ length: 60 }, (_, i) => p(i)));
    await fireEvent.press(screen.getByLabelText('Points, 60'));
    expect(await screen.findByLabelText(/^Point 60,/)).toBeTruthy();
    expect(screen.getAllByLabelText(/^Point \d+,/)).toHaveLength(60);
    await act(async () => useSettings.setState({ coordinateFormat: 'latlon' }));
    expect(screen.getByLabelText(/^Point 1,/).props.accessibilityLabel).toContain('38.9');
    await fireEvent.press(screen.getByLabelText('Points, 60'));
    expect(screen.queryByLabelText(/^Point 1,/)).toBeNull();
  });

  it('edits and saves back to the view, and Cancel restores', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByRole('header')).toHaveTextContent('Edit line');
    await fireEvent.press(screen.getByLabelText('Remove point 3'));
    await fireEvent.press(screen.getByLabelText('Save'));
    await screen.findByTestId('line-title');
    expect(parseLineGeometry((await findItem(ctx.db, id))!.geometry)).toHaveLength(2);

    await fireEvent.press(screen.getByLabelText('Edit'));
    await act(async () => useDraft.getState().addVertex(p(7)));
    await fireEvent.press(screen.getByText('Cancel'));
    await screen.findByTestId('line-title');
    expect(useDraft.getState().vertices).toHaveLength(2);
  });

  it('tapping the notes opens the editor; what is typed is saved', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Add notes'));
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'hold here');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await findItem(ctx.db, id))?.notes).toBe('hold here'));
  });

  it('deletes from the view with two taps and closes without a "no longer exists" toast', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Delete'));
    await fireEvent.press(screen.getByLabelText('Tap again to delete'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(await findItem(ctx.db, id)).toBeNull();
    expect(useToast.getState().toast?.message).not.toBe('That line no longer exists.');
  });

  it('Lengths toggles distances on the map from the view; the form has no switch', async () => {
    await openEditor();
    await fireEvent.press(screen.getByLabelText('Show point distances'));
    expect(useSettings.getState().showLineDistances).toBe(!DEFAULT_SETTINGS.showLineDistances);
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.queryByLabelText('Show point distances')).toBeNull();
  });

  it('shows the 2-point hint only while editing a 2-point line', async () => {
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', points: [p(0), p(1)], lineType: 'phase-line', name: 'TWO' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('line.edit', { itemId: r.value.id }));
    await screen.findByTestId('line-title');
    expect(screen.queryByText('A line needs at least 2 points')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByText('A line needs at least 2 points')).toBeTruthy();
  });

  it('reports an unreadable line and redirects other categories both ways', async () => {
    const ctx = makeTestContext();
    const bad = await placeLine(ctx, { missionId: 'm1', points: [p(0), p(1)], lineType: 'phase-line', name: 'BAD' });
    const unit = await placePoint(ctx, { missionId: 'm1', coord: p(0), sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!bad.ok || !unit.ok) throw new Error('setup');
    await ctx.db.execute('UPDATE map_items SET geometry = ? WHERE id = ?', ['nope', bad.value.id]);
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('line.edit', { itemId: bad.value.id }));
    await waitFor(() => expect(useToast.getState().toast?.message).toBe('That line no longer exists.'));
    await act(async () => useMenu.getState().openMenu('line.edit', { itemId: unit.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: unit.value.id } }]));
  });
});
