import { act } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MeasureLayer } from './MeasureLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { role: string; label?: string }; geometry: { coordinates: unknown } }[] };
const shape = () => mapboxMock().__props.ShapeSource.measure.shape as Shape;

beforeEach(() => {
  useMeasure.setState(INITIAL_MEASURE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('MeasureLayer', () => {
  it('shows only the start until the end is set, and never follows the camera', async () => {
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    useInteraction.getState().setCamera({ center: { lat: 38.91, lon: -77 }, zoom: 14, bearing: 0 });
    await renderWithProviders(<MeasureLayer />);
    expect(shape().features.map((f) => f.properties.role)).toEqual(['dot']);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.92, lon: -77 }, zoom: 14, bearing: 0 }));
    expect(shape().features.map((f) => f.properties.role)).toEqual(['dot']);
    await act(async () => useMeasure.getState().place({ lat: 38.91, lon: -77 }));
    expect(shape().features.map((f) => f.properties.role)).toEqual(['line', 'dot', 'dot', 'chip']);
    expect(shape().features.find((f) => f.properties.role === 'chip')!.properties.label).toBe('1.11 km · 000° TRUE');
    const props = mapboxMock().__props;
    for (const id of ['measure-halo', 'measure-line']) expect(props.LineLayer[id]).toBeDefined();
    for (const id of ['measure-dots', 'measure-chip']) expect(props.SymbolLayer[id]).toBeDefined();
  });
});
