import { act } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { GridLayer } from './GridLayer';
import { mgrsGrid, orientEastings } from './mgrs-grid';

jest.mock('@rnmapbox/maps');

const VIEW = { sw: { lat: 38.85, lon: -77.1 }, ne: { lat: 38.95, lon: -76.98 }, zoom: 12 };

beforeEach(() => {
  useSettings.setState({ ...DEFAULT_SETTINGS, showMgrsGrid: true });
  useInteraction.setState({ ...INITIAL_INTERACTION, gridView: VIEW });
});

describe('GridLayer', () => {
  it('draws the grid for the grid view', async () => {
    await renderWithProviders(<GridLayer />);
    const props = mapboxMock().__props;
    expect(props.ShapeSource['mgrs-grid'].shape).toEqual(orientEastings(mgrsGrid(VIEW).lines, true));
    expect(props.ShapeSource['mgrs-grid-areas'].shape).toEqual(mgrsGrid(VIEW).labels);
  });

  it('sits under the mission items (it may mount after them, when switched on)', async () => {
    await renderWithProviders(<GridLayer />);
    const props = mapboxMock().__props;
    for (const layer of [props.LineLayer['mgrs-grid-lines'], props.SymbolLayer['mgrs-grid-easting-labels'], props.SymbolLayer['mgrs-grid-northing-labels'], props.SymbolLayer['mgrs-grid-area-labels']]) {
      expect(layer.belowLayerID).toBe('polygons-fill');
    }
  });

  it('reads easting numbers along their lines (no flipping upright), and northing numbers left to right', async () => {
    await renderWithProviders(<GridLayer />);
    const props = mapboxMock().__props;
    expect(props.SymbolLayer['mgrs-grid-easting-labels'].style).toMatchObject({ textKeepUpright: false });
    expect(props.SymbolLayer['mgrs-grid-easting-labels'].filter).toEqual(['==', ['get', 'axis'], 'e']);
    expect(props.SymbolLayer['mgrs-grid-northing-labels'].style).not.toHaveProperty('textKeepUpright');
    expect(props.SymbolLayer['mgrs-grid-northing-labels'].filter).toEqual(['==', ['get', 'axis'], 'n']);
  });

  it('runs easting lines north to south, and turns them around when the map turns far enough', async () => {
    await renderWithProviders(<GridLayer />);
    expect(mapboxMock().__props.ShapeSource['mgrs-grid'].shape).toEqual(orientEastings(mgrsGrid(VIEW).lines, true));
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.9, lon: -77 }, zoom: 12, bearing: 270 }));
    expect(mapboxMock().__props.ShapeSource['mgrs-grid'].shape).toEqual(orientEastings(mgrsGrid(VIEW).lines, false));
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.9, lon: -77 }, zoom: 12, bearing: 0 }));
    expect(mapboxMock().__props.ShapeSource['mgrs-grid'].shape).toEqual(orientEastings(mgrsGrid(VIEW).lines, true));
  });

  it('redraws only when the grid view moves on, not with every camera change', async () => {
    await renderWithProviders(<GridLayer />);
    const shape = mapboxMock().__props.ShapeSource['mgrs-grid'].shape;
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 10, lon: 10 }, zoom: 3, bearing: 0 }));
    expect(mapboxMock().__props.ShapeSource['mgrs-grid'].shape).toBe(shape);
    const next = { ...VIEW, zoom: 15 };
    await act(async () => useInteraction.setState({ gridView: next }));
    expect(mapboxMock().__props.ShapeSource['mgrs-grid'].shape).toEqual(orientEastings(mgrsGrid(next).lines, true));
  });

  it('stops at 1 km lines with the 100 m lines setting off', async () => {
    const close = { ...VIEW, zoom: 15 };
    useInteraction.setState({ gridView: close });
    await renderWithProviders(<GridLayer />);
    expect(mapboxMock().__props.ShapeSource['mgrs-grid'].shape).toEqual(orientEastings(mgrsGrid(close).lines, true));
    await act(async () => useSettings.getState().setShowGrid100m(false));
    expect(mapboxMock().__props.ShapeSource['mgrs-grid'].shape).toEqual(orientEastings(mgrsGrid(close, 1_000).lines, true));
  });

  it('hides the labels with the grid labels setting', async () => {
    await renderWithProviders(<GridLayer />);
    const props = mapboxMock().__props;
    expect(props.SymbolLayer['mgrs-grid-easting-labels'].style).toMatchObject({ visibility: 'visible' });
    await act(async () => useSettings.getState().setShowGridLabels(false));
    expect(props.SymbolLayer['mgrs-grid-easting-labels'].style).toMatchObject({ visibility: 'none' });
    expect(props.SymbolLayer['mgrs-grid-northing-labels'].style).toMatchObject({ visibility: 'none' });
    expect(props.SymbolLayer['mgrs-grid-area-labels'].style).toMatchObject({ visibility: 'none' });
    expect(props.LineLayer['mgrs-grid-lines']).toBeDefined();
  });

  it.each([
    ['the grid is off', { showMgrsGrid: false }, VIEW],
    ['the map has not come to rest yet', {}, null],
  ])('draws nothing while %s', async (_, settings, gridView) => {
    useSettings.setState(settings);
    useInteraction.setState({ gridView });
    delete mapboxMock().__props.ShapeSource['mgrs-grid'];
    await renderWithProviders(<GridLayer />);
    expect(mapboxMock().__props.ShapeSource['mgrs-grid']).toBeUndefined();
  });
});
