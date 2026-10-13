import { act } from '@testing-library/react-native';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { DraftLineLayer } from './DraftLineLayer';

jest.mock('@rnmapbox/maps');

beforeEach(() => useDraft.setState(INITIAL_DRAFT));

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
});
