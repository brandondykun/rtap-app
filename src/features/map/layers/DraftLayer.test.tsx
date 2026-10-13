import { act } from '@testing-library/react-native';

import { composeSidc } from '@/features/symbology/presets';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { DraftLayer } from './DraftLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { role: string; label?: string; sidc?: string } }[] };
const DRAFT = { lat: 38.905, lon: -77.03 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  usePresence.setState(INITIAL_PRESENCE);
});

describe('DraftLayer', () => {
  it('draws the draft symbol and its NEW label', async () => {
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair' });
    useDraft.getState().setAutoName('HOS-4');
    await renderWithProviders(<DraftLayer />);
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features[0].properties).toMatchObject({ role: 'draft', label: 'HOS-4 · NEW', sidc: composeSidc('hostile', 'unspecified') });
    expect(mapboxMock().__props.SymbolLayer['draft-ring']).toBeDefined();
    expect(mapboxMock().__props.LineLayer['draft-range-line']).toBeDefined();
  });

  it('adds the range line once there is a fix and keeps styles stable', async () => {
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair' });
    await renderWithProviders(<DraftLayer />);
    const labelStyle = mapboxMock().__props.SymbolLayer['draft-label'].style;
    await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: 5, timestamp: 1 }));
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features.map((f) => f.properties.role)).toEqual(['draft', 'range', 'range-label']);
    expect(mapboxMock().__props.SymbolLayer['draft-label'].style).toBe(labelStyle);
  });

  it('labels an edit draft EDIT', async () => {
    useDraft.getState().startEdit({ itemId: 'i1', coord: DRAFT, affiliation: 'friend', unitType: 'armor', name: 'FRD-2', notes: '' });
    await renderWithProviders(<DraftLayer />);
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features[0].properties.label).toBe('FRD-2 · EDIT');
  });
});
