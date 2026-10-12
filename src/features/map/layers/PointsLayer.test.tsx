import { act, waitFor } from '@testing-library/react-native';

import { placePoint, toggleItemVisibility } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { PointsLayer } from './PointsLayer';

jest.mock('@rnmapbox/maps');

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

type Shape = { features: { properties: { id: string; name: string } }[] };

describe('PointsLayer', () => {
  it('renders the mission points in one source and hides by filter', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });
    await placePoint(ctx, { missionId: 'm2', coord: at, sidc: HOSTILE_INF, name: 'OTHER' });
    if (!a.ok) throw new Error('setup');

    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(2));

    await act(async () => {
      await toggleItemVisibility(ctx, a.value.id);
    });
    await waitFor(() => expect(props.SymbolLayer['points-symbols'].filter).toEqual(hiddenFilter([a.value.id])));
    expect(props.SymbolLayer['points-labels'].filter).toEqual(hiddenFilter([a.value.id]));
    // Hiding never rebuilds the source.
    expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(2);
  });

  it('keeps layer styles stable across data updates', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(1));
    const symbolStyle = props.SymbolLayer['points-symbols'].style;
    const labelStyle = props.SymbolLayer['points-labels'].style;

    await act(async () => {
      await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });
    });
    await waitFor(() => expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(2));
    expect(props.SymbolLayer['points-symbols'].style).toBe(symbolStyle);
    expect(props.SymbolLayer['points-labels'].style).toBe(labelStyle);
  });
});
