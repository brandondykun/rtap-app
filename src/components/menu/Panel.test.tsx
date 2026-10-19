import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Dimensions, Keyboard, StyleSheet, Text } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';


import { Panel } from './Panel';
import { detentHeights, drawerWidth } from './panel-geometry';

const Theme = ({ children }: { children: ReactNode }) => <ThemeProvider theme="dark">{children}</ThemeProvider>;
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: Theme });

const INSETS = { top: 0, right: 0, bottom: 0, left: 0 }; // the global safe-area mock reports zero insets
const TOP_RESERVED = 76;

function metrics() {
  const { width, height } = Dimensions.get('window');
  return { width, height, insets: INSETS, topReserved: TOP_RESERVED };
}

function Probe({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <Text>content</Text>;
}

describe('Panel', () => {
  it('opens a bottom sheet at its initial detent and publishes its frame', async () => {
    const onFrameChange = jest.fn();
    await render(
      <Panel landscape={false} detents={['peek', 'half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>,
    );
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByTestId('menu-panel-handle')).toBeTruthy();
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
  });

  it('opens a left drawer in landscape', async () => {
    const onFrameChange = jest.fn();
    await render(
      <Panel landscape detents={['half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>,
    );
    expect(screen.queryByTestId('menu-panel-handle')).toBeNull();
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'left', size: drawerWidth(metrics()) });
  });

  it('falls back to the new initial detent when the menu changes to one without the current detent', async () => {
    const onFrameChange = jest.fn();
    const ui = (detents: ('peek' | 'half' | 'full')[], initialDetent: 'peek' | 'half') => (
      <Panel landscape={false} detents={detents} initialDetent={initialDetent} topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>
    );
    const { rerender } = await render(ui(['peek', 'half', 'full'], 'peek'));
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).peek });
    await rerender(ui(['half', 'full'], 'half'));
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
  });

  it('does not bring back an earlier detent after a menu that does not allow it', async () => {
    const onFrameChange = jest.fn();
    const ui = (detents: ('peek' | 'half' | 'full')[], initialDetent: 'peek' | 'half') => (
      <Panel landscape={false} detents={detents} initialDetent={initialDetent} topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>
    );
    const { rerender } = await render(ui(['peek', 'half', 'full'], 'peek'));
    await rerender(ui(['half', 'full'], 'half'));
    await rerender(ui(['peek', 'half', 'full'], 'half'));
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
  });

  it('keeps its content mounted when the orientation changes', async () => {
    const onMount = jest.fn();
    const onFrameChange = jest.fn();
    const ui = (landscape: boolean) => (
      <Panel landscape={landscape} detents={['half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Probe onMount={onMount} />
      </Panel>
    );
    const { rerender } = await render(ui(false));
    await rerender(ui(true));
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'left', size: drawerWidth(metrics()) });
  });

  it('returns to the user detent after repeated keyboard shows', async () => {
    const handlers: Record<string, () => void> = {};
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      handlers[event] = cb;
      return { remove: jest.fn() };
    }) as never);
    const onFrameChange = jest.fn();
    await render(
      <Panel landscape={false} detents={['peek', 'half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>,
    );
    const show = handlers.keyboardWillShow ?? handlers.keyboardDidShow;
    const hide = handlers.keyboardWillHide ?? handlers.keyboardDidHide;
    await act(async () => show());
    await act(async () => show());
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).full });
    await act(async () => hide());
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
    spy.mockRestore();
  });

  describe('minimizing the landscape drawer', () => {
    const drawer = (props: { minimized: boolean; onMinimizedChange?: (m: boolean) => void; onFrameChange?: jest.Mock; landscape?: boolean }) => (
      <Panel
        landscape={props.landscape ?? true}
        detents={['half', 'full']}
        initialDetent="half"
        topReserved={TOP_RESERVED}
        title="Add unit"
        minimized={props.minimized}
        onMinimizedChange={props.onMinimizedChange ?? jest.fn()}
        onFrameChange={props.onFrameChange ?? jest.fn()}>
        <Text>content</Text>
      </Panel>
    );

    it('has a full-height rail on its right edge, holding just a chevron, that hides the drawer', async () => {
      const onMinimizedChange = jest.fn();
      await render(drawer({ minimized: false, onMinimizedChange }));
      const rail = screen.getByLabelText('Hide menu');
      expect(rail.props.testID).toBe('menu-panel-rail');
      // Part of the drawer (inside it, not floating beside it), spanning its height.
      expect(screen.getByTestId('menu-panel')).toContainElement(rail);
      expect(rail.props.className).toContain('h-full');
      // A slim rail: it should not take much from the menu.
      expect(StyleSheet.flatten(rail.props.style).width).toBe(16);
      expect(screen.queryByText(/hide/i)).toBeNull();
      // No floating button while the drawer is open.
      expect(screen.queryByTestId('menu-panel-tab')).toBeNull();
      await fireEvent.press(rail);
      expect(onMinimizedChange).toHaveBeenCalledWith(true);
    });

    it('while minimized, frees the whole map, keeps the menu mounted, and the tab brings it back', async () => {
      const onMinimizedChange = jest.fn();
      const onFrameChange = jest.fn();
      await render(drawer({ minimized: true, onMinimizedChange, onFrameChange }));
      // No frame: the map, crosshair and controls use the full width.
      expect(onFrameChange).toHaveBeenLastCalledWith(null);
      // Still mounted, but hidden from screen readers while off screen.
      expect(screen.getByText('content', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByText('content')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Show Add unit'));
      expect(onMinimizedChange).toHaveBeenCalledWith(false);
    });

    it('reports its width again when restored', async () => {
      const onFrameChange = jest.fn();
      const { rerender } = await render(drawer({ minimized: true, onFrameChange }));
      await rerender(drawer({ minimized: false, onFrameChange }));
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'left', size: drawerWidth(metrics()) });
    });

    it('turns the minimized tab into a floating button just past the notch, rounded on all corners', async () => {
      // The global safe-area mock is itself a jest.fn: restoring a spy would drop its zero insets, so put them back instead.
      const insets = jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 0, right: 0, bottom: 21, left: 59 });
      try {
        await render(drawer({ minimized: true }));
        const frame = StyleSheet.flatten(screen.getByTestId('menu-panel-tab-frame').props.style);
        expect(frame.left).toBe(59);
        expect(frame.width).toBe(36);
        const tab = screen.getByTestId('menu-panel-tab');
        expect(tab.props.className).toContain('rounded-xl');
        expect(tab.props.className).not.toContain('rounded-r-xl');
        expect(tab.props.className).not.toContain('border-l-0');
      } finally {
        insets.mockReturnValue(INSETS);
      }
    });

    it('shows the open menu on the minimized button: its icon, what it holds, and an expand chevron', async () => {
      await render(
        <Panel
          landscape
          detents={['half', 'full']}
          initialDetent="half"
          topReserved={TOP_RESERVED}
          title="Add polygon"
          minimized
          minimizedTab={{ icon: 'pentagon-outline', label: 'OBJ-1', detail: '3 PTS', spoken: 'OBJ-1, 3 points' }}
          onMinimizedChange={jest.fn()}
          onFrameChange={jest.fn()}>
          <Text>content</Text>
        </Panel>,
      );
      const tab = screen.getByLabelText('Show Add polygon, OBJ-1, 3 points');
      expect(tab).toHaveTextContent(/OBJ-1.*3 PTS/);
      // Read bottom to top, like a spine label.
      expect(StyleSheet.flatten(screen.getByTestId('menu-panel-tab-label').props.style).transform).toEqual([{ rotate: '-90deg' }]);
      expect(screen.getByText('3 PTS').props.className).toContain('text-accent');
      expect(tab.props.className).toContain('border-accent');
    });

    it('keeps the floating button off the screen edge where there is no notch', async () => {
      await render(drawer({ minimized: true }));
      expect(StyleSheet.flatten(screen.getByTestId('menu-panel-tab-frame').props.style).left).toBe(4);
    });

    it('has no rail or tab in portrait (the sheet already drags down)', async () => {
      await render(drawer({ minimized: false, landscape: false }));
      expect(screen.queryByLabelText('Hide menu')).toBeNull();
      expect(screen.queryByTestId('menu-panel-rail')).toBeNull();
    });
  });
});
