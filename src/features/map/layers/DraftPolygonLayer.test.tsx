import { act } from '@testing-library/react-native';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { DraftPolygonLayer } from './DraftPolygonLayer';

jest.mock('@rnmapbox/maps');

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('DraftPolygonLayer', () => {
  it('draws the draft, selects a vertex, and passes other taps on as map taps', async () => {
    const onVertexPress = jest.fn();
    const onPress = jest.fn();
    useDraft.getState().startAddPolygon();
    for (const lat of [38.9, 38.91, 38.92]) useDraft.getState().addVertex({ lat, lon: lat === 38.91 ? -76.99 : -77 });
    await renderWithProviders(<DraftPolygonLayer onVertexPress={onVertexPress} onPress={onPress} />);
    const props = mapboxMock().__props;
    expect(props.FillLayer['draft-polygon-fill']).toBeDefined();
    for (const id of ['draft-polygon-halo', 'draft-polygon-solid', 'draft-polygon-dashed']) expect(props.LineLayer[id]).toBeDefined();
    for (const id of ['draft-polygon-segment', 'draft-polygon-selected', 'draft-polygon-vertex', 'draft-polygon-center', 'draft-polygon-radius', 'draft-polygon-label']) {
      expect(props.SymbolLayer[id]).toBeDefined();
    }
    const press = props.ShapeSource['draft-polygon'].onPress as (e: unknown) => void;
    await act(async () => press({ features: [{ properties: { role: 'label' } }, { properties: { role: 'vertex', index: 2 } }], coordinates: { latitude: 38.92, longitude: -77 }, point: {} }));
    expect(onVertexPress).toHaveBeenCalledWith(2);
    await act(async () => press({ features: [{ properties: { role: 'fill' } }], coordinates: { latitude: 38.91, longitude: -76.995 }, point: {} }));
    expect(onPress).toHaveBeenCalledWith({ lat: 38.91, lon: -76.995 });
  });


  it('keeps the fill in its own untappable source so items inside an open polygon stay tappable', async () => {
    useDraft.getState().startAddPolygon();
    for (const lat of [38.9, 38.91, 38.92]) useDraft.getState().addVertex({ lat, lon: lat === 38.91 ? -76.99 : -77 });
    await renderWithProviders(<DraftPolygonLayer />);
    const props = mapboxMock().__props;
    expect(props.ShapeSource['draft-polygon-fills'].onPress).toBeUndefined();
    expect((props.ShapeSource['draft-polygon-fills'].shape as { features: unknown[] }).features).toHaveLength(1);
    const touchable = props.ShapeSource['draft-polygon'].shape as { features: { properties: { role: string } }[] };
    expect(touchable.features.some((f) => f.properties.role === 'fill')).toBe(false);
  });
});
