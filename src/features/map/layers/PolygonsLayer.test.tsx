import { act, waitFor } from '@testing-library/react-native';

import { placePolygon } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { PolygonsLayer } from './PolygonsLayer';

jest.mock('@rnmapbox/maps');

const tri = [{ lat: 38.9, lon: -77 }, { lat: 38.91, lon: -77 }, { lat: 38.9, lon: -76.99 }];

describe('PolygonsLayer', () => {
  it('draws fill, outline and label; only the outline/label source is tappable', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'points', points: tri } });
    if (!r.ok) throw new Error('setup');
    const onItemPress = jest.fn();
    await renderWithProviders(<PolygonsLayer missionId="m1" excludeId={null} onItemPress={onItemPress} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource['polygon-fills'].shape as { features: unknown[] }).features).toHaveLength(1));
    expect(props.ShapeSource['polygon-fills'].onPress).toBeUndefined();
    expect(props.FillLayer['polygons-fill']).toBeDefined();
    for (const id of ['polygons-halo', 'polygons-solid', 'polygons-dashed']) expect(props.LineLayer[id]).toBeDefined();
    expect(props.SymbolLayer['polygons-label']).toBeDefined();
    await act(async () =>
      (props.ShapeSource.polygons.onPress as (e: unknown) => void)({ features: [{ properties: { id: r.value.id } }], coordinates: { latitude: 38.905, longitude: -77 }, point: {} }),
    );
    expect(onItemPress).toHaveBeenCalledWith(r.value.id, { lat: 38.905, lon: -77 }, { kind: 'polygon', sidc: null });
  });

  it('hides hidden and excluded polygons on every layer', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: 'IRON', shape: { kind: 'points', points: tri } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<PolygonsLayer missionId="m1" excludeId={r.value.id} />, ctx);
    const props = mapboxMock().__props;
    const hidden = JSON.stringify(hiddenFilter([r.value.id]));
    await waitFor(() => expect(JSON.stringify(props.FillLayer['polygons-fill'].filter)).toContain(hidden));
    expect(JSON.stringify(props.SymbolLayer['polygons-label'].filter)).toContain(hidden);
  });

  it('hides its labels (only) while map labels are off', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'points', points: tri } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<PolygonsLayer missionId="m1" excludeId={null} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(props.SymbolLayer['polygons-label'].style).toMatchObject({ visibility: 'visible' }));
    await act(async () => useSettings.getState().toggleMapLabels());
    expect(props.SymbolLayer['polygons-label'].style).toMatchObject({ visibility: 'none' });
    useSettings.setState(DEFAULT_SETTINGS);
  });
});
