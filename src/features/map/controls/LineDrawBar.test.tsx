import { act, fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { CONTROL_SIZE, EDGE, GAP } from '../layout';
import { LineDrawBar } from './LineDrawBar';

const C = { lat: 38.9, lon: -77 };

beforeEach(() => {
  useMapChrome.setState(INITIAL_MAP_CHROME);
  useDraft.setState(INITIAL_DRAFT);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
  useDraft.getState().startAddLine();
});

describe('LineDrawBar', () => {
  it('adds at center, undoes, and names the next point', async () => {
    await renderWithProviders(<LineDrawBar panel={null} />);
    expect(screen.getByText('Tap map')).toBeTruthy();
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Add at center'));
    expect(useDraft.getState().vertices).toEqual([C]);
    expect(screen.getByText('Tap map')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(useDraft.getState().vertices).toEqual([]);
  });

  it('switches to move and insert modes', async () => {
    await act(async () => {
      useDraft.getState().addVertex({ lat: 38.8, lon: -77 });
      useDraft.getState().addVertex({ lat: 38.85, lon: -77 });
      useDraft.getState().selectVertex(0);
    });
    await renderWithProviders(<LineDrawBar panel={null} />);
    expect(screen.getByText('Tap map')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Move to center'));
    expect(useDraft.getState().vertices[0]).toEqual(C);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(useDraft.getState().selectedVertex).toBeNull();
    await act(async () => useDraft.getState().startInsertAfter(0));
    expect(screen.getByText('Tap map')).toBeTruthy();
  });

  it('guides a circle: center at the crosshair, then the edge', async () => {
    await act(async () => {
      useDraft.getState().startAddPolygon();
      useDraft.getState().setPolygonShape('circle');
    });
    await renderWithProviders(<LineDrawBar panel={null} />);
    await fireEvent.press(screen.getByLabelText('Set center at crosshair'));
    expect(useDraft.getState().coord).toEqual(C);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.9045, lon: -77 }, zoom: 14, bearing: 0 }));
    await fireEvent.press(screen.getByLabelText('Set edge at crosshair'));
    expect(useDraft.getState().circleRadiusM).toBeCloseTo(500, -1);
    expect(screen.queryByLabelText('Undo')).toBeNull();
  });

  it('sits above your grid card and the panel, clear of the zoom column', async () => {
    useMapChrome.getState().setSelfCard({ width: 250, height: 64 });
    await renderWithProviders(<LineDrawBar panel={{ side: 'bottom', size: 300 }} />);
    expect(screen.getByTestId('line-draw-bar')).toHaveStyle({ bottom: 300 + EDGE + 64 + GAP, right: EDGE + CONTROL_SIZE + GAP });
  });
});
