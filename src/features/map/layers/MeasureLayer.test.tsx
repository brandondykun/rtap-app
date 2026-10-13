import { act } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MeasureLayer } from './MeasureLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { role: string; label?: string; live?: boolean }; geometry: { coordinates: unknown } }[] };
const shape = () => mapboxMock().__props.ShapeSource.measure.shape as Shape;

beforeEach(() => {
  useMeasure.setState(INITIAL_MEASURE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('MeasureLayer', () => {
  it('follows the camera with a live, dashed end until the end is fixed', async () => {
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    useInteraction.getState().setCamera({ center: { lat: 38.91, lon: -77 }, zoom: 14, bearing: 0 });
    await renderWithProviders(<MeasureLayer />);
    expect(shape().features.find((f) => f.properties.role === 'line')!.properties.live).toBe(true);
    expect(shape().features.find((f) => f.properties.role === 'chip')!.properties.label).toBe('1.11 km · 000° TRUE');
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.92, lon: -77 }, zoom: 14, bearing: 0 }));
    expect(shape().features.find((f) => f.properties.role === 'chip')!.properties.label).toMatch(/^2\.2\d km/);
    await act(async () => useMeasure.getState().place({ lat: 38.91, lon: -77 }));
    expect(shape().features.find((f) => f.properties.role === 'line')!.properties.live).toBe(false);
    const props = mapboxMock().__props;
    for (const id of ['measure-halo', 'measure-solid', 'measure-dashed']) expect(props.LineLayer[id]).toBeDefined();
    for (const id of ['measure-dots', 'measure-chip']) expect(props.SymbolLayer[id]).toBeDefined();
  });
});
