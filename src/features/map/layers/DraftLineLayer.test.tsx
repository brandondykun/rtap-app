import { act } from '@testing-library/react-native';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { DraftLineLayer } from './DraftLineLayer';

jest.mock('@rnmapbox/maps');

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('DraftLineLayer', () => {
  it('draws the draft and selects a vertex when its marker is tapped', async () => {
    const onVertexPress = jest.fn();
    useDraft.getState().startAddLine();
    useDraft.getState().addVertex({ lat: 38.9, lon: -77 });
    useDraft.getState().addVertex({ lat: 38.91, lon: -77 });
    await renderWithProviders(<DraftLineLayer onVertexPress={onVertexPress} />);
    const props = mapboxMock().__props;
    expect((props.ShapeSource['draft-line'].shape as { features: unknown[] }).features.length).toBeGreaterThan(0);
    for (const id of ['draft-line-halo', 'draft-line-solid', 'draft-line-dashed']) expect(props.LineLayer[id]).toBeDefined();
    for (const id of ['draft-line-segment', 'draft-line-vertex', 'draft-line-selected', 'draft-line-label']) expect(props.SymbolLayer[id]).toBeDefined();
    await act(async () => (props.ShapeSource['draft-line'].onPress as (e: unknown) => void)({ features: [{ properties: { role: 'vertex', index: 1 } }], coordinates: {}, point: {} }));
    expect(onVertexPress).toHaveBeenCalledWith(1);
  });


  it('finds the vertex among overlapping features, and passes other taps on as map taps', async () => {
    const onVertexPress = jest.fn();
    const onPress = jest.fn();
    useDraft.getState().startAddLine();
    useDraft.getState().addVertex({ lat: 38.9, lon: -77 });
    useDraft.getState().addVertex({ lat: 38.91, lon: -77 });
    await renderWithProviders(<DraftLineLayer onVertexPress={onVertexPress} onPress={onPress} />);
    const press = mapboxMock().__props.ShapeSource['draft-line'].onPress as (e: unknown) => void;
    await act(async () =>
      press({ features: [{ properties: { role: 'label' } }, { properties: { role: 'vertex', index: 1 } }], coordinates: { latitude: 38.91, longitude: -77 }, point: {} }),
    );
    expect(onVertexPress).toHaveBeenCalledWith(1);
    await act(async () => press({ features: [{ properties: { role: 'segment' } }], coordinates: { latitude: 38.905, longitude: -77.001 }, point: {} }));
    expect(onPress).toHaveBeenCalledWith({ lat: 38.905, lon: -77.001 });
    expect(onVertexPress).toHaveBeenCalledTimes(1);
  });

  it('draws the end arrow and FLOT bumps of the line type', async () => {
    useDraft.getState().startAddLine();
    await renderWithProviders(<DraftLineLayer />);
    const props = mapboxMock().__props;
    for (const id of ['draft-line-arrow', 'draft-line-flot']) expect(props.SymbolLayer[id]).toBeDefined();
  });


  it('hides the distance chips when the setting is off', async () => {
    useSettings.getState().setShowLineDistances(false);
    useDraft.getState().startAddLine();
    useDraft.getState().addVertex({ lat: 38.9, lon: -77 });
    useDraft.getState().addVertex({ lat: 38.91, lon: -77 });
    await renderWithProviders(<DraftLineLayer />);
    const shape = mapboxMock().__props.ShapeSource['draft-line'].shape as { features: { properties: { role: string } }[] };
    expect(shape.features.some((f) => f.properties.role === 'segment')).toBe(false);
  });
});
