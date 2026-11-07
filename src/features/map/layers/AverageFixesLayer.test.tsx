import { act } from '@testing-library/react-native';

import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { AverageFixesLayer } from './AverageFixesLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: unknown[] };
const shape = (id: string) => mapboxMock().__props.ShapeSource[id].shape as Shape;
const fix = (t: number) => ({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: t, altitudeM: 10 });

beforeEach(() => {
  useGpsAverage.setState(INITIAL_GPS_AVERAGE);
  usePresence.setState(INITIAL_PRESENCE);
});

/** Averaging with three fixes, the average published as "me". */
async function averageThree() {
  await act(async () => {
    const g = useGpsAverage.getState();
    g.start();
    let out = null;
    for (let i = 0; i < 3; i++) out = g.addFix(fix(i * 1000), 0);
    usePresence.getState().setSelfPosition(out!);
  });
}

describe('AverageFixesLayer', () => {
  it('draws nothing until switched on from the fix count', async () => {
    await renderWithProviders(<AverageFixesLayer />);
    await averageThree();
    expect(shape('average-fixes').features).toEqual([]);
    expect(shape('average-ring').features).toEqual([]);
  });

  it('draws a dot for each fix and only the average’s ± ring when switched on', async () => {
    await renderWithProviders(<AverageFixesLayer />);
    await averageThree();
    await act(async () => useGpsAverage.getState().toggleFixes());
    expect(shape('average-fixes').features).toHaveLength(3);
    expect(shape('average-ring').features).toHaveLength(1);
    const { CircleLayer, LineLayer } = mapboxMock().__props;
    expect(CircleLayer['average-fix-dots'].style).toMatchObject({ circleColor: themeColors('dark').averaged });
    // No ring per fix: thousands of them stalled panning and zooming.
    expect(Object.keys(CircleLayer)).toEqual(['average-fix-dots']);
    expect(LineLayer['average-ring-line'].style).toMatchObject({ lineDasharray: [3, 2] });
  });

  it('clears when Average mode turns off', async () => {
    await renderWithProviders(<AverageFixesLayer />);
    await averageThree();
    await act(async () => useGpsAverage.getState().toggleFixes());
    await act(async () => useGpsAverage.getState().stop());
    expect(shape('average-fixes').features).toEqual([]);
    expect(shape('average-ring').features).toEqual([]);
  });
});
