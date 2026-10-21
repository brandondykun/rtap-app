import { act } from '@testing-library/react-native';

import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { opIconSize } from './op-icon-size';
import { QuickPlotLayer } from './QuickPlotLayer';

jest.mock('@rnmapbox/maps');

beforeEach(() => {
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  usePresence.setState(INITIAL_PRESENCE);
  useOp.setState(INITIAL_OP);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('QuickPlotLayer', () => {
  it('in OP mode draws the range from the OP, not from me', async () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.92, lon: -77 } });
    useQuickPlot.getState().plot({ lat: 38.91, lon: -77 });
    await renderWithProviders(<QuickPlotLayer />);
    const shape = mapboxMock().__props.ShapeSource['quick-plot'].shape as { features: { properties: { role: string; label?: string } }[] };
    expect(shape.features.find((f) => f.properties.role === 'range-label')!.properties.label).toBe('1.11 km · 180°');
  });

  it('draws the reticle, TEMP chip and the range from me', async () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    useQuickPlot.getState().plot({ lat: 38.91, lon: -77 });
    await renderWithProviders(<QuickPlotLayer />);
    const props = mapboxMock().__props;
    const shape = props.ShapeSource['quick-plot'].shape as { features: { properties: { role: string; label?: string } }[] };
    expect(shape.features.find((f) => f.properties.role === 'range-label')!.properties.label).toBe('1.11 km · 000°');
    expect(props.LineLayer['quick-plot-range']).toBeDefined();
    for (const id of ['quick-plot-range-label', 'quick-plot-reticle', 'quick-plot-label']) expect(props.SymbolLayer[id]).toBeDefined();
    expect(props.ShapeSource['quick-plot'].onPress).toBeUndefined();
  });

  it('in OP mode sizes the reticle by zoom, and back to normal after', async () => {
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.92, lon: -77 } });
    useQuickPlot.getState().plot({ lat: 38.91, lon: -77 });
    await renderWithProviders(<QuickPlotLayer />);
    const size = () => (mapboxMock().__props.SymbolLayer['quick-plot-reticle'].style as { iconSize?: unknown }).iconSize;
    expect(size()).toEqual(opIconSize(undefined));
    await act(async () => useOp.getState().exit());
    expect(size()).toBeUndefined();
  });
});
