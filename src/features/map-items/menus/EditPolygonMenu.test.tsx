import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MenuHost } from '@/features/menus/MenuHost';
import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { placePoint, placePolygon } from '../commands';
import { findItem } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const C = { lat: 38.9, lon: -77 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useToast.setState({ toast: null });
});

describe('EditPolygonMenu', () => {
  it('opens a circle read-only with its exact center and radius, and saves a new radius', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: C, radiusM: 500 } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('polygon.edit', { itemId: r.value.id }));
    await screen.findByDisplayValue('1');
    expect(screen.getByRole('header')).toHaveTextContent('Polygon');
    expect(screen.getByLabelText('Radius')).toHaveDisplayValue('500');
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(C).northing);
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Radius'), '750');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(JSON.parse((await findItem(ctx.db, r.value.id))!.style!).radiusM).toBe(750));
  });

  it('reports an unreadable polygon and redirects other categories', async () => {
    const ctx = makeTestContext();
    const bad = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: 'BAD', shape: { kind: 'points', points: [C, { lat: 38.91, lon: -77 }, { lat: 38.9, lon: -76.99 }] } });
    const unit = await placePoint(ctx, { missionId: 'm1', coord: C, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!bad.ok || !unit.ok) throw new Error('setup');
    await ctx.db.write(async () => {
      const record = await findItem(ctx.db, bad.value.id);
      await record!.update((m) => {
        m.geometry = 'nope';
      });
    });
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('polygon.edit', { itemId: bad.value.id }));
    await waitFor(() => expect(useToast.getState().toast?.message).toBe('That polygon no longer exists.'));
    await act(async () => useMenu.getState().openMenu('polygon.edit', { itemId: unit.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: unit.value.id } }]));
  });
});
