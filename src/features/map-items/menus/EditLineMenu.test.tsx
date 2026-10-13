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

async function openEditor() {
  const ctx = makeTestContext();
  const r = await placeLine(ctx, { missionId: 'm1', points: [p(0), p(1), p(2)], lineType: 'phase-line', name: 'RED' });
  if (!r.ok) throw new Error('setup');
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('line.edit', { itemId: r.value.id }));
  await screen.findByDisplayValue('RED');
  return { ctx, id: r.value.id };
}

describe('EditLineMenu', () => {
  it('opens read-only, edits and saves, and Cancel restores', async () => {
    const { ctx, id } = await openEditor();
    expect(screen.getByRole('header')).toHaveTextContent('Line');
    expect(screen.getByLabelText('Remove point 3')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByRole('header')).toHaveTextContent('Edit line');
    await fireEvent.press(screen.getByLabelText('Remove point 3'));
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByRole('header')).toHaveTextContent('Line'));
    expect(parseLineGeometry((await findItem(ctx.db, id))!.geometry)).toHaveLength(2);

    await fireEvent.press(screen.getByLabelText('Edit'));
    await act(async () => useDraft.getState().addVertex(p(7)));
    await fireEvent.press(screen.getByText('Cancel'));
    expect(useDraft.getState().vertices).toHaveLength(2);
  });

  it('deletes after a second tap', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.press(screen.getByText('Delete line'));
    await fireEvent.press(screen.getByText('Tap again to delete'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(await findItem(ctx.db, id)).toBeNull();
  });

  it('reports an unreadable line and redirects other categories both ways', async () => {
    const ctx = makeTestContext();
    const bad = await placeLine(ctx, { missionId: 'm1', points: [p(0), p(1)], lineType: 'phase-line', name: 'BAD' });
    const unit = await placePoint(ctx, { missionId: 'm1', coord: p(0), sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!bad.ok || !unit.ok) throw new Error('setup');
    await ctx.db.write(async () => {
      const record = await findItem(ctx.db, bad.value.id);
      await record!.update((m) => {
        m.geometry = 'nope';
      });
    });
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('line.edit', { itemId: bad.value.id }));
    await waitFor(() => expect(useToast.getState().toast?.message).toBe('That line no longer exists.'));
    await act(async () => useMenu.getState().openMenu('line.edit', { itemId: unit.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: unit.value.id } }]));
  });


  it('does not show the 2-point hint while only viewing a 2-point line', async () => {
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', points: [p(0), p(1)], lineType: 'phase-line', name: 'TWO' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('line.edit', { itemId: r.value.id }));
    await screen.findByDisplayValue('TWO');
    expect(screen.queryByText('A line needs at least 2 points')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByText('A line needs at least 2 points')).toBeTruthy();
  });


  it('toggles distances on the map even while only viewing', async () => {
    await openEditor();
    const toggle = screen.getByLabelText('Show distances');
    expect(toggle).not.toBeDisabled();
    await fireEvent(toggle, 'valueChange', false);
    expect(useSettings.getState().showLineDistances).toBe(false);
  });
});
