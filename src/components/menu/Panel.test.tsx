import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import { useContext, useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Dimensions, Keyboard, ScrollView, StyleSheet, Text } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';


import { MenuHeader } from './MenuHeader';
import { Panel } from './Panel';
import { PanelScrollContext } from './panel-header-slot';
import { detentHeights, drawerWidth, MINIMIZED_BAR_HEIGHT, minimizedBarSize, SHEET_CHROME_HEIGHT, SHEET_EDGE_HEIGHT } from './panel-geometry';

const Theme = ({ children }: { children: ReactNode }) => <ThemeProvider theme="dark">{children}</ThemeProvider>;
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: Theme });

const INSETS = { top: 0, right: 0, bottom: 0, left: 0 }; // the global safe-area mock reports zero insets
const TOP_RESERVED = 76;

function metrics() {
  const { width, height } = Dimensions.get('window');
  return { width, height, insets: INSETS, topReserved: TOP_RESERVED };
}

/** What a device does right after layout: the sheet learns how tall its content is (tall unless given). */
const measure = (height = 5000) => fireEvent(screen.getByTestId('menu-panel-scroll'), 'contentSizeChange', 390, height);

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
    await measure();
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

  it('lays the landscape drawer out at its full width at once and slides it in, never growing its width', async () => {
    await render(
      <Panel landscape detents={['half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={jest.fn()}>
        <Text>content</Text>
      </Panel>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('menu-panel').props.style);
    expect(style.width).toBe(drawerWidth(metrics()));
    expect(style.transform).toContainEqual({ translateX: expect.any(Number) });
  });

  it('falls back to the new initial detent when the menu changes to one without the current detent', async () => {
    const onFrameChange = jest.fn();
    const ui = (detents: ('peek' | 'half' | 'full')[], initialDetent: 'peek' | 'half') => (
      <Panel landscape={false} detents={detents} initialDetent={initialDetent} topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>
    );
    const { rerender } = await render(ui(['peek', 'half', 'full'], 'peek'));
    await measure();
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
    await measure();
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
    await measure();
    const show = handlers.keyboardWillShow ?? handlers.keyboardDidShow;
    const hide = handlers.keyboardWillHide ?? handlers.keyboardDidHide;
    await act(async () => show());
    await act(async () => show());
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).full });
    await act(async () => hide());
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
    spy.mockRestore();
  });

  describe('the menu header', () => {
    const withHeader = (onFrameChange = jest.fn(), onClose = jest.fn(), landscape = false) => (
      <Panel landscape={landscape} detents={['peek', 'half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <MenuHeader title="Settings" leading={{ label: 'Close', onPress: onClose }} trailing={{ label: 'Save', onPress: jest.fn() }} />
        <Text>content</Text>
      </Panel>
    );

    it.each([[false], [true]])('stays pinned above the scrolling content (landscape=%s)', async (landscape) => {
      const onClose = jest.fn();
      await render(withHeader(jest.fn(), onClose, landscape));
      const header = screen.getByTestId('menu-panel-header');
      expect(screen.getByTestId('menu-panel')).toContainElement(header);
      expect(header).toContainElement(screen.getByText('Close'));
      expect(header).toContainElement(screen.getByLabelText('Save'));
      expect(screen.getByTestId('menu-panel-scroll')).not.toContainElement(screen.getByText('Close'));
      expect(screen.getByTestId('menu-panel-scroll')).toContainElement(screen.getByText('content'));
      await fireEvent.press(screen.getByText('Close'));
      expect(onClose).toHaveBeenCalled();
    });

    it.each([[false], [true]])('shows no drag grip with a header, which is itself the drag area (landscape=%s)', async (landscape) => {
      await render(withHeader(jest.fn(), jest.fn(), landscape));
      expect(screen.queryByTestId('menu-panel-grip')).toBeNull();
      expect(screen.queryByTestId('menu-panel-handle')).toBeNull();
    });

    it('counts the pinned header when fitting short content', async () => {
      const onFrameChange = jest.fn();
      await render(withHeader(onFrameChange));
      await fireEvent(screen.getByTestId('menu-panel-header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 52 } } });
      await measure(180);
      // The header is the drag area, so there is no grip row to count.
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: 180 + SHEET_EDGE_HEIGHT + 52 });
    });

    it('shows the next menu\'s header when the menu changes, and none once a menu without one is shown', async () => {
      const ui = (menu: 'root' | 'settings' | 'bare') => (
        <Panel landscape={false} detents={['half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} contentKey={menu} onFrameChange={jest.fn()}>
          {menu === 'bare' ? <Text key="bare">bare</Text> : <MenuHeader key={menu} title={menu} leading={{ label: menu === 'root' ? 'Close' : 'Back', onPress: jest.fn() }} />}
        </Panel>
      );
      const { rerender } = await render(ui('root'));
      expect(screen.getByTestId('menu-panel-header')).toHaveTextContent(/Close/);
      await rerender(ui('settings'));
      expect(screen.getByTestId('menu-panel-header')).toHaveTextContent(/Back/);
      await rerender(ui('bare'));
      expect(screen.queryByTestId('menu-panel-header')).toBeNull();
    });

    it('draws in place outside a panel', async () => {
      await render(<MenuHeader title="Settings" leading={{ label: 'Close', onPress: jest.fn() }} />);
      expect(screen.getByText('Close')).toBeTruthy();
      expect(screen.queryByTestId('menu-panel-header')).toBeNull();
    });
  });

  describe('fitting short content', () => {
    const sheet = (onFrameChange: jest.Mock, landscape = false) => (
      <Panel landscape={landscape} detents={['peek', 'half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>
    );

    it('opens only as tall as short content needs', async () => {
      const onFrameChange = jest.fn();
      await render(sheet(onFrameChange));
      await fireEvent(screen.getByTestId('menu-panel-scroll'), 'contentSizeChange', 390, 180);
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: 180 + SHEET_CHROME_HEIGHT });
    });

    it('stays closed until its content is measured, then opens once, straight to the fitted height', async () => {
      const onFrameChange = jest.fn();
      await render(sheet(onFrameChange));
      expect(onFrameChange).not.toHaveBeenCalled();
      await measure(180);
      expect(onFrameChange.mock.calls).toEqual([[{ side: 'bottom', size: 180 + SHEET_CHROME_HEIGHT }]]);
    });

    it('opens anyway when no measurement comes', async () => {
      jest.useFakeTimers();
      try {
        const onFrameChange = jest.fn();
        await render(sheet(onFrameChange));
        await act(async () => jest.advanceTimersByTime(250));
        expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
      } finally {
        jest.useRealTimers();
      }
    });

    it('holds its height when the menu changes until the new content is measured', async () => {
      const onFrameChange = jest.fn();
      const ui = (key: string) => (
        <Panel landscape={false} detents={['peek', 'half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} contentKey={key} onFrameChange={onFrameChange}>
          <Text>content</Text>
        </Panel>
      );
      const { rerender } = await render(ui('root'));
      await measure(180);
      await rerender(ui('settings'));
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: 180 + SHEET_CHROME_HEIGHT });
      await measure(5000);
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
      expect(onFrameChange).toHaveBeenCalledTimes(2);
    });

    it('keeps its detent for content taller than it', async () => {
      const onFrameChange = jest.fn();
      await render(sheet(onFrameChange));
      await fireEvent(screen.getByTestId('menu-panel-scroll'), 'contentSizeChange', 390, 5000);
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
    });

    it('still opens fully while the keyboard is up, so a focused field stays in view', async () => {
      const handlers: Record<string, () => void> = {};
      const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
        handlers[event] = cb;
        return { remove: jest.fn() };
      }) as never);
      try {
        const onFrameChange = jest.fn();
        await render(sheet(onFrameChange));
        await fireEvent(screen.getByTestId('menu-panel-scroll'), 'contentSizeChange', 390, 180);
        await act(async () => (handlers.keyboardWillShow ?? handlers.keyboardDidShow)());
        expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).full });
        await act(async () => (handlers.keyboardWillHide ?? handlers.keyboardDidHide)());
        expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: 180 + SHEET_CHROME_HEIGHT });
      } finally {
        spy.mockRestore();
      }
    });

    it('does not change the landscape drawer', async () => {
      const onFrameChange = jest.fn();
      await render(sheet(onFrameChange, true));
      await fireEvent(screen.getByTestId('menu-panel-scroll'), 'contentSizeChange', 320, 180);
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'left', size: drawerWidth(metrics()) });
    });
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
      // Square corners: the drawer's right edge (where the rail sits) is not rounded.
      expect(screen.getByTestId('menu-panel').props.className).not.toMatch(/rounded/);
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

    it('edges its content column with a left border just past the notch', async () => {
      const insets = jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 0, right: 59, bottom: 21, left: 59 });
      try {
        await render(drawer({ minimized: false }));
        const column = screen.getByTestId('menu-panel-column');
        expect(column.props.className).toContain('border-l');
        expect(StyleSheet.flatten(column.props.style).marginLeft).toBe(59);
      } finally {
        insets.mockReturnValue(INSETS);
      }
    });

    it('has no left border on the portrait sheet', async () => {
      await render(drawer({ minimized: false, landscape: false }));
      expect(screen.getByTestId('menu-panel-column').props.className ?? '').not.toContain('border-l');
    });

    it('keeps the floating button off the screen edge where there is no notch', async () => {
      await render(drawer({ minimized: true }));
      expect(StyleSheet.flatten(screen.getByTestId('menu-panel-tab-frame').props.style).left).toBe(4);
    });

  });

  describe('minimizing the portrait sheet', () => {
    const sheet = (props: { minimized: boolean; onMinimizedChange?: (m: boolean) => void; onFrameChange?: jest.Mock; landscape?: boolean }) => (
      <Panel
        landscape={props.landscape ?? false}
        detents={['peek', 'half', 'full']}
        initialDetent="half"
        topReserved={TOP_RESERVED}
        title="Add unit"
        minimized={props.minimized}
        minimizedTab={{ icon: 'account-group', label: 'HOS-1', detail: 'INF', spoken: 'HOS-1, infantry' }}
        onMinimizedChange={props.onMinimizedChange ?? jest.fn()}
        onFrameChange={props.onFrameChange ?? jest.fn()}>
        <Text>content</Text>
      </Panel>
    );

    it('has square corners and a full-width rail along its top edge that hides the sheet', async () => {
      const onMinimizedChange = jest.fn();
      await render(sheet({ minimized: false, onMinimizedChange }));
      const panel = screen.getByTestId('menu-panel');
      expect(panel.props.className).not.toMatch(/rounded/);
      const rail = screen.getByLabelText('Hide menu');
      expect(rail.props.testID).toBe('menu-panel-rail');
      expect(panel).toContainElement(rail);
      expect(rail.props.className).toContain('w-full');
      // As slim as the landscape rail, turned on its side.
      expect(StyleSheet.flatten(rail.props.style).height).toBe(16);
      expect(screen.queryByTestId('menu-panel-tab')).toBeNull();
      await fireEvent.press(rail);
      expect(onMinimizedChange).toHaveBeenCalledWith(true);
    });

    it('drags by a dotted grip under the rail', async () => {
      await render(sheet({ minimized: false }));
      expect(screen.getByTestId('menu-panel-handle')).toContainElement(screen.getByTestId('menu-panel-grip'));
    });

    it('while minimized, keeps the menu mounted and reports only the reopen bar along the bottom', async () => {
      const onMinimizedChange = jest.fn();
      const onFrameChange = jest.fn();
      await render(sheet({ minimized: true, onMinimizedChange, onFrameChange }));
      // The grid readouts sit on top of the bar, not where the sheet was.
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: minimizedBarSize(0) });
      expect(screen.getByText('content', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByText('content')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Show Add unit, HOS-1, infantry'));
      expect(onMinimizedChange).toHaveBeenCalledWith(false);
    });

    it('lays the reopen bar along the very bottom, styled like the landscape tab but reading across', async () => {
      const insets = jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 47, right: 0, bottom: 34, left: 0 });
      try {
        const onFrameChange = jest.fn();
        await render(sheet({ minimized: true, onFrameChange }));
        const frame = StyleSheet.flatten(screen.getByTestId('menu-panel-tab-frame').props.style);
        // As wide as the grid dock above it.
        expect(frame).toMatchObject({ bottom: 34, left: 12, right: 12, height: MINIMIZED_BAR_HEIGHT });
        expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: minimizedBarSize(34) });
        const tab = screen.getByTestId('menu-panel-tab');
        expect(tab.props.className).toContain('rounded-xl');
        expect(tab.props.className).toContain('border-accent');
        expect(tab).toHaveTextContent(/HOS-1.*INF/);
        expect(StyleSheet.flatten(screen.getByTestId('menu-panel-tab-label').props.style)?.transform).toBeUndefined();
      } finally {
        insets.mockReturnValue(INSETS);
      }
    });

    it('stays minimized when the phone turns from landscape to portrait', async () => {
      const onFrameChange = jest.fn();
      const { rerender } = await render(sheet({ minimized: true, landscape: true, onFrameChange }));
      expect(onFrameChange).toHaveBeenLastCalledWith(null);
      await rerender(sheet({ minimized: true, landscape: false, onFrameChange }));
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: minimizedBarSize(0) });
      expect(screen.getByLabelText('Show Add unit, HOS-1, infantry')).toBeTruthy();
      expect(screen.queryByText('content')).toBeNull();
    });

    it('reports its height again when restored', async () => {
      const onFrameChange = jest.fn();
      const { rerender } = await render(sheet({ minimized: true, onFrameChange }));
      await rerender(sheet({ minimized: false, onFrameChange }));
      await measure();
      expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
    });
  });

  describe('scroll position per content', () => {
    const scrollTo = () => jest.mocked(ScrollView.prototype.scrollTo);
    const panel = (contentKey: object, restoreScrollY?: number, onScrollY = jest.fn()) => (
      <Panel landscape={false} detents={['half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={jest.fn()} contentKey={contentKey} restoreScrollY={restoreScrollY} onScrollY={onScrollY}>
        <Text>content</Text>
      </Panel>
    );
    const scrollView = () => screen.getByTestId('menu-panel-scroll');

    beforeEach(() => scrollTo().mockClear());

    it('reports where its content is scrolled to', async () => {
      const onScrollY = jest.fn();
      await render(panel({}, undefined, onScrollY));
      await fireEvent.scroll(scrollView(), { nativeEvent: { contentOffset: { x: 0, y: 300 } } });
      expect(onScrollY).toHaveBeenLastCalledWith(300);
    });

    it('scrollToTop jumps to the top, clears the header hairline, and again once a still-open keyboard closes', async () => {
      function Top() {
        const scroll = useContext(PanelScrollContext);
        return <Text onPress={() => scroll?.scrollToTop()}>top</Text>;
      }
      let hideKeyboard = () => {};
      jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
      const listen = jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
        if (name === 'keyboardDidHide') hideKeyboard = () => (cb as (e: unknown) => void)({});
        return { remove: () => {} } as ReturnType<typeof Keyboard.addListener>;
      });
      try {
        await render(
          <Panel landscape detents={['full']} initialDetent="full" topReserved={TOP_RESERVED} onFrameChange={jest.fn()}>
            <MenuHeader title="Unit" />
            <Top />
          </Panel>,
        );
        await fireEvent.scroll(scrollView(), { nativeEvent: { contentOffset: { x: 0, y: 300 } } });
        expect(screen.getByTestId('menu-panel-hairline').props.className).not.toContain('opacity-0');
        await fireEvent.press(screen.getByText('top'));
        expect(scrollTo()).toHaveBeenLastCalledWith({ y: 0, animated: false });
        expect(screen.getByTestId('menu-panel-hairline').props.className).toContain('opacity-0');
        scrollTo().mockClear();
        await act(async () => hideKeyboard());
        expect(scrollTo()).toHaveBeenCalledWith({ y: 0, animated: false });
      } finally {
        listen.mockRestore();
        jest.mocked(Keyboard.isVisible).mockRestore();
      }
    });

    it('starts new content at the top', async () => {
      const r = await render(panel({}));
      await r.rerender(panel({}));
      expect(scrollTo()).toHaveBeenLastCalledWith({ y: 0, animated: false });
    });

    it('returns to a remembered position once the content is long enough to reach it', async () => {
      const r = await render(panel({}));
      await r.rerender(panel({}, 300));
      await fireEvent(scrollView(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 400 } } });
      // The list is still loading: as far as it goes.
      await fireEvent(scrollView(), 'contentSizeChange', 390, 500);
      expect(scrollTo()).toHaveBeenLastCalledWith({ y: 100, animated: false });
      await fireEvent(scrollView(), 'contentSizeChange', 390, 900);
      expect(scrollTo()).toHaveBeenLastCalledWith({ y: 300, animated: false });
      // Reached: later growth leaves the user's scrolling alone.
      scrollTo().mockClear();
      await fireEvent(scrollView(), 'contentSizeChange', 390, 1200);
      expect(scrollTo()).not.toHaveBeenCalled();
    });
  });
});
