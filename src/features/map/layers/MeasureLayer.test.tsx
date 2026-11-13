import { act } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MEASURE_DOT_HITBOX, MeasureLayer } from './MeasureLayer';
import { opSize, opTextSize } from './op-symbol-scale';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { role: string; label?: string }; geometry: { coordinates: unknown } }[] };
const source = (id: string) => mapboxMock().__props.ShapeSource[id].shape as Shape;
/** Both sources together, in drawing order: the line, the dots, then the chip. */
const roles = () => {
  const [main, dots] = [source('measure').features, source('measure-points').features];
  return [...main.filter((f) => f.properties.role === 'line'), ...dots, ...main.filter((f) => f.properties.role === 'chip')].map((f) => f.properties.role);
};
const shape = () => source('measure');

beforeEach(() => {
  useMeasure.setState(INITIAL_MEASURE);
  useOp.setState(INITIAL_OP);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('MeasureLayer', () => {
  it('shows only the start until the end is set, and never follows the camera', async () => {
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    useInteraction.getState().setCamera({ center: { lat: 38.91, lon: -77 }, zoom: 14, bearing: 0 });
    await renderWithProviders(<MeasureLayer />);
    expect(roles()).toEqual(['dot']);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.92, lon: -77 }, zoom: 14, bearing: 0 }));
    expect(roles()).toEqual(['dot']);
    await act(async () => useMeasure.getState().place({ lat: 38.91, lon: -77 }));
    expect(roles()).toEqual(['line', 'dot', 'dot', 'chip']);
    expect(shape().features.find((f) => f.properties.role === 'chip')!.properties.label).toBe('1.11 km · 000° TRUE');
    const props = mapboxMock().__props;
    for (const id of ['measure-halo', 'measure-line']) expect(props.LineLayer[id]).toBeDefined();
    for (const id of ['measure-dots', 'measure-numbers', 'measure-chip']) expect(props.SymbolLayer[id]).toBeDefined();
  });

  it('a tap on a dot picks it to move (and again lets it go); only the dots take taps', async () => {
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    useMeasure.getState().place({ lat: 38.91, lon: -77 });
    await renderWithProviders(<MeasureLayer />);
    const props = mapboxMock().__props;
    expect(props.ShapeSource.measure.onPress).toBeUndefined();
    expect(props.ShapeSource['measure-points'].hitbox).toEqual(MEASURE_DOT_HITBOX);
    const tap = (point: string) => (props.ShapeSource['measure-points'].onPress as (e: unknown) => void)({ features: [{ properties: { point } }] });
    await act(async () => tap('end'));
    expect(useMeasure.getState().editing).toBe('end');
    const picked = () => source('measure-points').features.map((f) => (f.properties as { picked?: boolean }).picked);
    expect(picked()).toEqual([false, true]);
    expect(props.CircleLayer['measure-picked'].style).toMatchObject({ circleStrokeColor: expect.any(String), circleOpacity: 0 });
    await act(async () => tap('end'));
    expect(useMeasure.getState().editing).toBeNull();
  });

  it('in OP mode sizes the dots by zoom, and back to normal after', async () => {
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } });
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    await renderWithProviders(<MeasureLayer />);
    const size = () => (mapboxMock().__props.SymbolLayer['measure-dots'].style as { iconSize?: unknown }).iconSize;
    expect(size()).toEqual(opSize(undefined));
    await act(async () => useOp.getState().exit());
    expect(size()).toBeUndefined();
  });

  it('in OP mode sizes the chip and the dot numbers by zoom, and back to normal after', async () => {
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    await renderWithProviders(<MeasureLayer />);
    const size = (id: string) => (mapboxMock().__props.SymbolLayer[id].style as { textSize?: unknown }).textSize;
    useInteraction.setState({ cameraZoom: 18 });
    const before = ['measure-chip', 'measure-numbers'].map((id) => size(id));
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } }));
    ['measure-chip', 'measure-numbers'].forEach((id, i) => expect(size(id)).toEqual(opTextSize(before[i] as number, 18)));
    await act(async () => useOp.getState().exit());
    ['measure-chip', 'measure-numbers'].forEach((id, i) => expect(size(id)).toEqual(before[i]));
  });
});
