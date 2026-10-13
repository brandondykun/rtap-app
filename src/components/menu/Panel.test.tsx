import { act, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Dimensions, Keyboard, Text } from 'react-native';

import { Panel } from './Panel';
import { detentHeights, drawerWidth } from './panel-geometry';

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
});
