import { act, waitFor } from '@testing-library/react-native';

import { placeLine } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { useInteraction } from '@/stores/interaction';
import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { LinesLayer } from './LinesLayer';
import { opSize } from './op-symbol-scale';

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

  it('hides its labels (only) while map labels are off', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'restrictive-fire-line', name: 'ALPHA' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<LinesLayer missionId="m1" excludeId={null} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(props.SymbolLayer['lines-label'].style).toMatchObject({ visibility: 'visible' }));
    await act(async () => useSettings.getState().toggleMapLabels());
    expect(props.SymbolLayer['lines-label'].style).toMatchObject({ visibility: 'none' });
    useSettings.setState(DEFAULT_SETTINGS);
  });

  it('keeps end labels upright as the map turns, restyling only every 15 degrees', async () => {
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'phase-line', name: 'RED' });
    if (!r.ok) throw new Error('setup');
    const camera = { center: P[0], zoom: 13 };
    useInteraction.getState().setCamera({ ...camera, bearing: 0 });
    await renderWithProviders(<LinesLayer missionId="m1" excludeId={null} />, ctx);
    const props = mapboxMock().__props;
    const style = () => props.SymbolLayer['lines-label'].style as { textRotate: unknown };
    await waitFor(() => expect(style()).toMatchObject({ textRotationAlignment: 'map' }));
    const north = style();
    await act(async () => useInteraction.getState().setCamera({ ...camera, bearing: 5 }));
    expect(style()).toBe(north);
    await act(async () => useInteraction.getState().setCamera({ ...camera, bearing: 100 }));
    expect(JSON.stringify(style().textRotate)).not.toBe(JSON.stringify(north.textRotate));
    useInteraction.getState().setCamera({ ...camera, bearing: 0 });
  });

  it('in OP mode sizes the labels by zoom, and back to normal after', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    const ctx = makeTestContext();
    await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'restrictive-fire-line', name: 'ALPHA' });
    await renderWithProviders(<LinesLayer missionId="m1" excludeId={null} />, ctx);
    const size = (id: string) => (mapboxMock().__props.SymbolLayer[id].style as { textSize?: unknown }).textSize;
    const before = ['lines-label'].map((id) => size(id));
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } }));
    ['lines-label'].forEach((id, i) => expect(size(id)).toEqual(opSize(before[i] as number)));
    await act(async () => useOp.getState().exit());
    ['lines-label'].forEach((id, i) => expect(size(id)).toEqual(before[i]));
  });
});
