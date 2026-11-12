import { act, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { CONTROL_SIZE, EDGE, GAP, TOOLBAR_HEIGHT } from '../layout';
import { MapControls, TALL_SHEET_FRACTION } from './MapControls';

/** A window height for one test (`null`: the real one), for the screens too short to tell some layouts apart. */
let mockWindowHeight: number | null = null;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => {
    const window = jest.requireActual('react-native/Libraries/Utilities/Dimensions').default.get('window');
    return mockWindowHeight === null ? window : { ...window, height: mockWindowHeight };
  },
}));

beforeEach(() => {
  mockWindowHeight = null;
  useInteraction.setState(INITIAL_INTERACTION);
  useMapChrome.setState(INITIAL_MAP_CHROME);
  useSettings.setState(DEFAULT_SETTINGS);
});

function handlers() {
  return { onNorthUp: jest.fn(), onZoomIn: jest.fn(), onZoomOut: jest.fn(), onRecenter: jest.fn(), onSetLocation: jest.fn() };
}

describe('MapControls', () => {
  it('calls the camera actions', async () => {
    const h = handlers();
    useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 30 });
    await renderWithProviders(<MapControls following={false} canRecenter {...h} panel={null} landscape={false} />);
    await fireEvent.press(screen.getByLabelText('North up'));
    await fireEvent.press(screen.getByLabelText('Zoom in'));
    await fireEvent.press(screen.getByLabelText('Zoom out'));
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(h.onNorthUp).toHaveBeenCalledTimes(1);
    expect(h.onZoomIn).toHaveBeenCalledTimes(1);
    expect(h.onZoomOut).toHaveBeenCalledTimes(1);
    expect(h.onRecenter).toHaveBeenCalledTimes(1);
  });

  it('lets touches through the bottom controls box to the map in both orientations (only the controls catch them)', async () => {
    for (const landscape of [false, true]) {
      await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={landscape} />);
      expect(screen.getByTestId('map-controls-bottom')).toHaveProp('pointerEvents', 'box-none');
      await screen.unmount();
    }
  });

  it('shows a side control in place of the zoom buttons (OP mode), in both orientations', async () => {
    for (const landscape of [false, true]) {
      await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={landscape} side={<Text testID="side">eye</Text>} />);
      expect(screen.getByTestId('side')).toBeTruthy();
      expect(screen.queryByLabelText('Zoom in')).toBeNull();
      await screen.unmount();
    }
  });

  it('keeps a side control under the toolbar, never over it, in both orientations', async () => {
    for (const landscape of [false, true]) {
      await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={landscape} side={<Text>eye</Text>} />);
      expect(StyleSheet.flatten(screen.getByTestId('map-controls-bottom').props.style).top).toBe(EDGE + TOOLBAR_HEIGHT + GAP);
      await screen.unmount();
      // Without one, the controls stay anchored at the bottom only.
      await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={landscape} />);
      expect(StyleSheet.flatten(screen.getByTestId('map-controls-bottom').props.style).top).toBeUndefined();
      await screen.unmount();
    }
  });

  it('can hide north-up even while rotated (OP mode)', async () => {
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 40 }));
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} showNorthUp={false} />);
    expect(screen.queryByLabelText('North up')).toBeNull();
  });

  it('hides north-up while the map points north and brings it back once rotated', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter {...h} panel={null} landscape={false} />);
    expect(screen.queryByLabelText('North up')).toBeNull();
    expect(screen.getByTestId('north-up', { includeHiddenElements: true })).toHaveProp('pointerEvents', 'none');
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 12 }));
    expect(screen.getByLabelText('North up')).toBeTruthy();
    expect(screen.getByTestId('north-up')).toHaveProp('pointerEvents', 'auto');
    // Within a fraction of a degree (either side of 0/360) counts as north.
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 359.8 }));
    expect(screen.queryByLabelText('North up')).toBeNull();
  });

  it('hides the zoom buttons when the setting is off', async () => {
    useSettings.getState().setShowZoomButtons(false);
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape />);
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    expect(screen.queryByLabelText('Zoom out')).toBeNull();
    expect(screen.getByLabelText('Recenter on me')).toBeTruthy();
  });

  it('rotates the needle against the map bearing', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 30 }));
    expect(StyleSheet.flatten(screen.getByTestId('north-needle').props.style).transform).toEqual([{ rotate: '-30deg' }]);
  });

  it('recenters from the ME row in portrait, with no locate button', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following canRecenter {...h} panel={null} landscape={false} />);
    expect(screen.getAllByLabelText('Recenter on me')).toHaveLength(1);
    expect(screen.getByLabelText('Recenter on me')).toBe(screen.getByTestId('dock-self'));
    expect(screen.getByLabelText('Recenter on me')).toBeSelected();
    await fireEvent.press(screen.getByTestId('dock-self'));
    expect(h.onRecenter).toHaveBeenCalledTimes(1);
  });

  it('disables recenter without a fix', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter={false} {...h} panel={null} landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(h.onRecenter).not.toHaveBeenCalled();
  });

  it('keeps zoom while a panel is open, lifted above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} landscape={false} />);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('map-controls-bottom').props.style).bottom).toBe(320 + EDGE);
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'left', size: 360 }} landscape />);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
  });

  it('in portrait, hides the readout dock once a menu is taller than half the screen, but keeps a docked action bar', async () => {
    const half = Dimensions.get('window').height * TALL_SHEET_FRACTION;
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: Math.floor(half) }} landscape={false} />);
    expect(screen.getByTestId('dock-self')).toBeTruthy();
    await screen.unmount();
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: Math.ceil(half) + 1 }} landscape={false} />);
    expect(screen.queryByTestId('dock-self')).toBeNull();
    await screen.unmount();
    await renderWithProviders(
      <MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: Math.ceil(half) + 1 }} landscape={false} bar={<Text>bar</Text>} />,
    );
    expect(screen.getByTestId('bar-in-dock')).toBeTruthy();
  });

  it('hides zoom and the dock when a full sheet leaves no room for them', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size }} landscape={false} showCenter />);
    expect(screen.queryByTestId('readout-dock')).toBeNull();
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
  });

  it('puts the inline dock bottom right under zoom in landscape, with no GPS toggle', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape />);
    expect(screen.queryByLabelText('GPS')).toBeNull();
    const bottom = screen.getByTestId('map-controls-bottom');
    expect(bottom).toHaveStyle({ bottom: EDGE, right: EDGE });
    const [buttons, slot] = bottom.children as { props: { testID?: string } }[];
    expect(buttons).toContainElement(screen.getByLabelText('Zoom in'));
    expect(slot.props.testID).toBe('self-card-slot');
    expect(slot).toContainElement(screen.getByTestId('dock-self'));
    expect(screen.getByTestId('readout-dock').props.className).not.toContain('mx-2');
    expect(screen.queryByTestId('dock-center')).toBeNull();
  });

  it('keeps the dock while a panel is open, above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} landscape={false} showCenter />);
    expect(screen.getByTestId('dock-center')).toBeTruthy();
    expect(screen.getByTestId('map-controls-bottom')).toHaveStyle({ bottom: 320 + EDGE });
    await screen.unmount();
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'left', size: 360 }} landscape />);
    expect(screen.getByTestId('dock-self')).toBeTruthy();
  });

  it('docks CTR over ME full width in portrait, under zoom on the right', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} showCenter />);
    const bottom = screen.getByTestId('map-controls-bottom');
    expect(bottom).toHaveStyle({ bottom: EDGE, left: EDGE, right: EDGE });
    const [buttons, slot] = bottom.children as { props: { testID?: string } }[];
    expect(buttons).toContainElement(screen.getByLabelText('Zoom in'));
    expect(slot.props.testID).toBe('self-card-slot');
    expect(slot).toContainElement(screen.getByTestId('dock-self'));
    expect(slot).toContainElement(screen.getByTestId('dock-center'));
    expect(screen.getByTestId('readout-dock').props.className).toContain('mx-2');
  });

  it('stacks CTR over ME in the bottom right in landscape, kept clear of a drawer', async () => {
    const { width } = Dimensions.get('window');
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'left', size: 360 }} landscape showCenter />);
    const dock = screen.getByTestId('readout-dock');
    expect(screen.getByTestId('map-controls-bottom')).toContainElement(dock);
    expect((dock.children as { props: { testID?: string } }[]).map((c) => c.props.testID)).toEqual(['dock-center', 'dock-divider', 'dock-self']);
    expect(dock).toHaveStyle({ maxWidth: width - 360 - 2 * EDGE });
  });

  it.each([[true], [false]])('leaves the center grid out when it is not shown (landscape=%s)', async (landscape) => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={landscape} />);
    expect(screen.queryByTestId('dock-center')).toBeNull();
    expect(screen.queryByTestId('dock-center')).toBeNull();
  });

  it('gives way zoom first, then the dock, when a bottom sheet leaves too little room', async () => {
    // A short screen, so the sheets stay under half of it (past half the dock always hides).
    mockWindowHeight = 390;
    const height = mockWindowHeight;
    const roomFor = (h: number) => height - h - (EDGE + TOOLBAR_HEIGHT + GAP + CONTROL_SIZE + GAP + EDGE);
    const dock = 2 * 50 + 1;
    const render = async (room: number) => {
      await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: roomFor(room) }} landscape={false} showCenter />);
    };
    // Room for the dock, not zoom too.
    await render(dock + 12 + 2 * CONTROL_SIZE - 10);
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    expect(screen.getByTestId('readout-dock')).toBeTruthy();
    await screen.unmount();
    await render(dock + 12 + 2 * CONTROL_SIZE + 10);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    await screen.unmount();
    await render(dock - 10);
    expect(screen.queryByTestId('readout-dock')).toBeNull();
  });

  it('keeps an action bar above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} landscape={false} bar={<View testID="bar" />} />);
    expect(screen.getByTestId('map-controls-bottom')).toContainElement(screen.getByTestId('bar'));
    expect(screen.getByTestId('map-controls-bottom')).toHaveStyle({ bottom: 320 + EDGE });
  });

  it('with Minimal grids in landscape, drops the details in landscape only', async () => {
    useSettings.setState({ minimalLandscapeGrids: true });
    useInteraction.getState().setCamera({ center: { lat: 38.9, lon: -77 }, zoom: 12, bearing: 0 });
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape showCenter />);
    expect(screen.getByTestId('dock-center')).toBeTruthy();
    expect(screen.queryByTestId('dock-center-details')).toBeNull();
    await screen.unmount();
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} showCenter />);
    expect(screen.getByTestId('dock-center-details')).toBeTruthy();
  });

  it('shows an action bar in place of the dock in portrait', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} bar={<View testID="bar" />} showCenter />);
    expect(screen.queryByTestId('readout-dock')).toBeNull();
    expect(screen.getByTestId('map-controls-bottom')).toContainElement(screen.getByTestId('bar'));
  });

  it('in landscape keeps both grids under an action bar, the bar left of the zoom buttons', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape bar={<View testID="bar" />} showCenter />);
    expect(screen.getByTestId('dock-center')).toBeTruthy();
    expect(screen.getByTestId('dock-self')).toBeTruthy();
    const [top, slot] = screen.getByTestId('map-controls-bottom').children as { props: { testID?: string } }[];
    expect(top.props.testID).toBe('bar-over-dock');
    expect(slot).toContainElement(screen.getByTestId('readout-dock'));
    expect(screen.getByTestId('bar-over-dock').props.className).toContain('flex-row');
    const [barSide, zoomSide] = screen.getByTestId('bar-over-dock').children as unknown[];
    expect(barSide).toContainElement(screen.getByTestId('bar'));
    expect(zoomSide).toBe(screen.getByTestId('zoom-group'));
  });

  it('in landscape keeps a side control (OP mode) and its action in one full-height column, the bar left of it', async () => {
    await renderWithProviders(
      <MapControls
        following={false}
        canRecenter
        {...handlers()}
        panel={null}
        landscape
        bar={<View testID="bar" />}
        side={<View testID="side" />}
        sideAction={<View testID="side-action" />}
        showCenter
      />,
    );
    const [barRow, slot] = screen.getByTestId('map-controls-bottom').children as { props: { testID?: string; className?: string } }[];
    expect(barRow.props.testID).toBe('bar-over-dock');
    expect(barRow.props.className).toContain('flex-1');
    const [barSide, column] = screen.getByTestId('bar-over-dock').children as { props: { testID?: string; className?: string } }[];
    expect(barSide).toContainElement(screen.getByTestId('bar'));
    expect(column.props.testID).toBe('side-column');
    expect(column.props.className).toContain('self-stretch');
    expect(column).toContainElement(screen.getByTestId('side'));
    expect(column).toContainElement(screen.getByTestId('side-action'));
    expect(slot).toContainElement(screen.getByTestId('readout-dock'));
  });

  const sideProps = () => ({ following: false, canRecenter: true, ...handlers(), panel: null, side: <View testID="side" />, sideAction: <View testID="side-action" /> });

  it('keeps a side action under the side control in landscape without a bar', async () => {
    await renderWithProviders(<MapControls {...sideProps()} landscape />);
    expect(screen.getByTestId('side-column')).toContainElement(screen.getByTestId('side-action'));
  });

  it('keeps a side action out of the bar in portrait', async () => {
    await renderWithProviders(<MapControls {...sideProps()} landscape={false} bar={<View testID="bar" />} barOverDock />);
    expect(screen.getByTestId('bar-over-dock')).not.toContainElement(screen.getByTestId('side-action'));
    expect(screen.getByTestId('side-action')).toBeTruthy();
  });

  it('in landscape with the zoom buttons hidden, puts the action bar flush right over the dock', async () => {
    useSettings.setState({ showZoomButtons: false });
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape bar={<View testID="bar" />} showCenter />);
    expect(screen.queryByTestId('zoom-group')).toBeNull();
    expect(screen.getByTestId('bar-over-dock')).toContainElement(screen.getByTestId('bar'));
    // The column is right-aligned (items-end), so the bar sits at the right edge.
    expect(screen.getByTestId('map-controls-bottom').props.className).toContain('items-end');
    expect(screen.getByTestId('dock-self')).toBeTruthy();
  });

  it('centers a bar that takes the dock place in portrait', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} bar={<View testID="bar" />} showCenter />);
    expect(screen.getByTestId('bar-in-dock')).toContainElement(screen.getByTestId('bar'));
    expect(screen.getByTestId('bar-in-dock').props.className).toContain('items-center');
  });

  it('floats a bar over the dock, centered, in portrait when asked; landscape always keeps it over the dock', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} bar={<View testID="bar" />} barOverDock showCenter />);
    const [, over, slot] = screen.getByTestId('map-controls-bottom').children as { props: { testID?: string } }[];
    expect(over.props.testID).toBe('bar-over-dock');
    expect(over).toContainElement(screen.getByTestId('bar'));
    expect(screen.getByTestId('bar-over-dock').props.className).toContain('items-center');
    expect(slot).toContainElement(screen.getByTestId('readout-dock'));
    await screen.unmount();
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape bar={<View testID="bar" />} barOverDock />);
    expect(screen.getByTestId('bar-over-dock')).toContainElement(screen.getByTestId('bar'));
    expect(screen.getByTestId('dock-self')).toBeTruthy();
  });

  it('keeps the action bar even when a full sheet leaves no room for your grid card', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size }} landscape={false} bar={<View testID="bar" />} />);
    expect(screen.getByTestId('bar')).toBeTruthy();
  });

  it('reports the card size for the bottom bars, and zero once it hides', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    await fireEvent(screen.getByTestId('self-card-slot'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 250, height: 64 } } });
    expect(useMapChrome.getState().selfCard).toEqual({ width: 250, height: 64 });
    await screen.unmount();
    expect(useMapChrome.getState().selfCard).toEqual({ width: 0, height: 0 });
  });

  it('draws the zoom group and the single buttons see-through, with no border', async () => {
    // North up only shows once the map is turned.
    useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 30 });
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    const group = screen.getByTestId('zoom-group').props.className as string;
    expect(group).toContain('bg-surface-glass');
    expect(group).not.toContain('border');
    const north = screen.getByLabelText('North up').props.className as string;
    expect(north).toContain('bg-surface-glass');
    expect(north).not.toContain('border');
  });
});
