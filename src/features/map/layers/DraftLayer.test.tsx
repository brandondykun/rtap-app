import { act } from '@testing-library/react-native';

import { composeSidc } from '@/features/symbology/presets';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { DraftLayer } from './DraftLayer';
import { opIconSize } from './op-icon-size';
import { DRAFT_SYMBOL_STYLE } from './styles';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { role: string; label?: string; sidc?: string } }[] };
const DRAFT = { lat: 38.905, lon: -77.03 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  usePresence.setState(INITIAL_PRESENCE);
  useOp.setState(INITIAL_OP);
});

describe('DraftLayer', () => {
  it('draws the point type symbol and follows type changes', async () => {
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair', category: 'point' });
    useDraft.getState().setAutoName('CP-1');
    await renderWithProviders(<DraftLayer />);
    const sidc = () => (mapboxMock().__props.ShapeSource.draft.shape as Shape).features[0].properties.sidc;
    expect(sidc()).toBe('GFGPGPPK------X');
    await act(async () => useDraft.getState().setPointType('observation-post'));
    expect(sidc()).toBe('GFGPDPO-------X');
  });

  it('draws the draft symbol and its NEW label', async () => {
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair', category: 'unit' });
    useDraft.getState().setAutoName('HOS-4');
    await renderWithProviders(<DraftLayer />);
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features[0].properties).toMatchObject({ role: 'draft', label: 'HOS-4 · NEW', sidc: composeSidc('hostile', 'unspecified') });
    expect(mapboxMock().__props.SymbolLayer['draft-ring']).toBeDefined();
    expect(mapboxMock().__props.LineLayer['draft-range-line']).toBeDefined();
    // The chip sits clear of the ring's bottom tick.
    const offset = (mapboxMock().__props.SymbolLayer['draft-label'].style as { textOffset: number[] }).textOffset;
    expect(offset[0]).toBe(0);
    expect(offset[1]).toBeCloseTo(3.3);
  });

  it('adds the range line once there is a fix and keeps styles stable', async () => {
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair', category: 'unit' });
    await renderWithProviders(<DraftLayer />);
    const labelStyle = mapboxMock().__props.SymbolLayer['draft-label'].style;
    await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: 5, timestamp: 1 }));
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features.map((f) => f.properties.role)).toEqual(['draft', 'range', 'range-label']);
    expect(mapboxMock().__props.SymbolLayer['draft-label'].style).toBe(labelStyle);
  });

  it('in OP mode draws the range line from the OP, not from me', async () => {
    const op = { lat: 38.95, lon: -77.1 };
    usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: 5, timestamp: 1 });
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: op });
    useDraft.getState().startEdit({ itemId: 'i1', coord: DRAFT, category: 'unit', pointType: 'checkpoint', affiliation: 'friend', unitType: 'armor', echelon: 'unspecified', name: 'FRD-2', notes: '' });
    await renderWithProviders(<DraftLayer />);
    const range = (mapboxMock().__props.ShapeSource.draft.shape as { features: { properties: { role: string }; geometry: { coordinates: number[][] } }[] }).features.find((f) => f.properties.role === 'range');
    expect(range?.geometry.coordinates[0]).toEqual([op.lon, op.lat]);
  });

  it('labels a selected point with its name only', async () => {
    useDraft.getState().startEdit({ itemId: 'i1', coord: DRAFT, category: 'unit', pointType: 'checkpoint', affiliation: 'friend', unitType: 'armor', echelon: 'unspecified', name: 'FRD-2', notes: '' });
    await renderWithProviders(<DraftLayer />);
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features[0].properties.label).toBe('FRD-2');
  });

  it('labels an edit draft EDIT', async () => {
    useDraft.getState().startEdit({ itemId: 'i1', coord: DRAFT, category: 'unit', pointType: 'checkpoint', affiliation: 'friend', unitType: 'armor', echelon: 'unspecified', name: 'FRD-2', notes: '' });
    useDraft.getState().setLocked(false);
    await renderWithProviders(<DraftLayer />);
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features[0].properties.label).toBe('FRD-2 · EDIT');
  });

  it('draws nothing for a line draft', async () => {
    useDraft.getState().startAddLine();
    // A stray coordinate (e.g. from a map tap) must still not draw a unit/point symbol.
    useDraft.getState().setCoord({ lat: 38.9, lon: -77 }, 'press');
    await renderWithProviders(<DraftLayer />);
    expect((mapboxMock().__props.ShapeSource.draft.shape as Shape).features).toEqual([]);
  });

  it('draws nothing for a polygon draft (its center is drawn by DraftPolygonLayer)', async () => {
    useDraft.getState().startAddPolygon();
    useDraft.getState().setCoord({ lat: 38.9, lon: -77 }, 'press');
    await renderWithProviders(<DraftLayer />);
    expect((mapboxMock().__props.ShapeSource.draft.shape as Shape).features).toEqual([]);
  });

  it('in OP mode sizes the draft symbol and its ring by zoom, and back to normal after', async () => {
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: DRAFT });
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair', category: 'point' });
    await renderWithProviders(<DraftLayer />);
    const size = (id: string) => (mapboxMock().__props.SymbolLayer[id].style as { iconSize?: unknown }).iconSize;
    expect(size('draft-symbol')).toEqual(opIconSize(DRAFT_SYMBOL_STYLE.iconSize));
    expect(size('draft-ring')).toEqual(opIconSize(undefined));
    await act(async () => useOp.getState().exit());
    expect(size('draft-symbol')).toEqual(DRAFT_SYMBOL_STYLE.iconSize);
    expect(size('draft-ring')).toBeUndefined();
  });
});
