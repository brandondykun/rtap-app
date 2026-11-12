import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { INITIAL_OP, useOp } from '@/stores/op';
import { renderWithProviders } from '@/test-utils/render';

import { OpGestures } from './OpGestures';

async function renderGestures() {
  await renderWithProviders(
    <OpGestures>
      <Text>map</Text>
    </OpGestures>,
  );
}

beforeEach(() => {
  useOp.setState(INITIAL_OP);
});

describe('OpGestures', () => {
  it('dragging right swings the view left (the scene follows the finger) and dragging down looks up', async () => {
    useOp.setState({ phase: 'on', bearing: 0, pitch: 40 });
    await renderGestures();
    await act(() => {
      fireGestureHandler(getByGestureTestId('op-pan'), [
        { state: State.BEGAN },
        { state: State.ACTIVE, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 40, translationY: 50 },
        { state: State.END },
      ]);
    });
    expect(useOp.getState().bearing).toBeCloseTo(350);
    expect(useOp.getState().pitch).toBeCloseTo(50);
  });

  it('ignores gestures when not in OP mode', async () => {
    await renderGestures();
    await act(() => {
      fireGestureHandler(getByGestureTestId('op-pan'), [
        { state: State.BEGAN },
        { state: State.ACTIVE, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 40, translationY: 50 },
        { state: State.END },
      ]);
    });
    expect(useOp.getState().bearing).toBe(INITIAL_OP.bearing);
    expect(useOp.getState().pitch).toBe(INITIAL_OP.pitch);
  });
});
