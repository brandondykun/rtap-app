import { act, waitFor } from '@testing-library/react-native';

import { placeLine } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { LinesLayer } from './LinesLayer';

jest.mock('@rnmapbox/maps');

const P = [{ lat: 38.9, lon: -77 }, { lat: 38.91, lon: -77 }];

describe('LinesLayer', () => {
  it('renders saved lines with solid, dashed, arrow, FLOT and label layers, all filtered', async () => {
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'restrictive-fire-line', name: 'ALPHA' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<LinesLayer missionId="m1" excludeId={null} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource.lines.shape as { features: unknown[] }).features).toHaveLength(1));
    for (const id of ['lines-halo', 'lines-solid', 'lines-dashed']) expect(props.LineLayer[id].filter).toBeDefined();
    for (const id of ['lines-arrow', 'lines-flot', 'lines-label']) expect(props.SymbolLayer[id]).toBeDefined();
    expect(props.LineLayer['lines-dashed'].style).toMatchObject({ lineDasharray: [2, 1.5] });
  });

  it('hides hidden and excluded lines and reports taps as lines', async () => {
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'phase-line', name: 'RED' });
    if (!r.ok) throw new Error('setup');
    const onItemPress = jest.fn();
    await renderWithProviders(<LinesLayer missionId="m1" excludeId={r.value.id} onItemPress={onItemPress} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(JSON.stringify(props.LineLayer['lines-solid'].filter)).toContain(JSON.stringify(hiddenFilter([r.value.id]))));
    await act(async () =>
      (props.ShapeSource.lines.onPress as (e: unknown) => void)({ features: [{ properties: { id: r.value.id } }], coordinates: { latitude: 38.905, longitude: -77 }, point: {} }),
    );
    expect(onItemPress).toHaveBeenCalledWith(r.value.id, { lat: 38.905, lon: -77 }, { kind: 'line', sidc: null });
  });
});
