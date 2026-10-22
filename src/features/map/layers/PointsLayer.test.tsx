import { act, waitFor } from '@testing-library/react-native';

import { placePoint, toggleItemVisibility } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { useInteraction } from '@/stores/interaction';
import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { opSize, opTextSize } from './op-symbol-scale';
import { POINT_LABEL_MIN_ZOOM, PointsLayer } from './PointsLayer';
import { POINT_SYMBOL_STYLE } from './styles';

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

  it('shows point labels only from zoom 13 in; symbols show at every zoom', async () => {
    // Placing thousands of crowded labels is what makes panning lag when zoomed out.
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(1));
    expect(props.SymbolLayer['points-labels'].minZoomLevel).toBe(POINT_LABEL_MIN_ZOOM);
    expect(POINT_LABEL_MIN_ZOOM).toBe(13);
    expect(props.SymbolLayer['points-symbols'].minZoomLevel).toBeUndefined();
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

  it('reports taps and leaves out the item being edited', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!a.ok) throw new Error('setup');
    const onItemPress = jest.fn();
    await renderWithProviders(<PointsLayer missionId="m1" excludeId={a.value.id} onItemPress={onItemPress} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(props.SymbolLayer['points-symbols'].filter).toEqual(hiddenFilter([a.value.id])));
    await act(async () =>
      (props.ShapeSource.points.onPress as (e: unknown) => void)({
        features: [{ properties: { id: a.value.id, sidc: HOSTILE_INF }, geometry: { type: 'Point', coordinates: [-77.0003, 38.9002] } }],
        coordinates: { latitude: 38.9001, longitude: -77.0001 },
        point: {},
      }),
    );
    // `at` is the finger; the last argument is the symbol's stored coordinate (for snapping), not the
    // tile-quantized rendered geometry.
    expect(onItemPress).toHaveBeenCalledWith(a.value.id, { lat: 38.9001, lon: -77.0001 }, { kind: 'point', sidc: HOSTILE_INF }, at);
  });

  it('hides its labels (only) while map labels are off', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(props.SymbolLayer['points-labels'].style).toMatchObject({ visibility: 'visible' }));
    await act(async () => useSettings.getState().toggleMapLabels());
    expect(props.SymbolLayer['points-labels'].style).toMatchObject({ visibility: 'none' });
    useSettings.setState(DEFAULT_SETTINGS);
  });

  it('sizes its labels by the label text size setting', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    const ctx = makeTestContext();
    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    expect(props.SymbolLayer['points-labels'].style).toMatchObject({ textSize: 12 });
    await act(async () => useSettings.getState().setLabelSize('large'));
    expect(props.SymbolLayer['points-labels'].style).toMatchObject({ textSize: 15 });
    useSettings.setState(DEFAULT_SETTINGS);
  });

  it('in OP mode sizes the symbols by zoom to hold their size as the view tilts, and back to normal after', async () => {
    useOp.setState({ ...INITIAL_OP, phase: 'on', at });
    await renderWithProviders(<PointsLayer missionId="m1" />);
    const style = () => mapboxMock().__props.SymbolLayer['points-symbols'].style as { iconSize: unknown };
    expect(style().iconSize).toEqual(opSize(POINT_SYMBOL_STYLE.iconSize));
    await act(async () => useOp.getState().exit());
    expect(style().iconSize).toEqual(POINT_SYMBOL_STYLE.iconSize);
  });

  it('in OP mode sizes the name labels by zoom, and back to normal after', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const size = (id: string) => (mapboxMock().__props.SymbolLayer[id].style as { textSize?: unknown }).textSize;
    useInteraction.setState({ cameraZoom: 18 });
    const before = ['points-labels'].map((id) => size(id));
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } }));
    ['points-labels'].forEach((id, i) => expect(size(id)).toEqual(opTextSize(before[i] as number, 18)));
    await act(async () => useOp.getState().exit());
    ['points-labels'].forEach((id, i) => expect(size(id)).toEqual(before[i]));
  });
});
