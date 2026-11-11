import { INITIAL_OP, useOp } from '@/stores/op';

import { OP_CAMERA_PUBLISH_MS, scheduleCameraPublish } from './camera-publish';

describe('scheduleCameraPublish', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useOp.setState(INITIAL_OP);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('publishes on the next frame on the map', () => {
    const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1);
    const cb = jest.fn();
    scheduleCameraPublish(cb);
    expect(raf).toHaveBeenCalledWith(cb);
  });

  it('at an OP, publishes at most every OP_CAMERA_PUBLISH_MS so turning does not redraw the readouts every frame', () => {
    const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1);
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } });
    const cb = jest.fn();
    scheduleCameraPublish(cb);
    expect(raf).not.toHaveBeenCalled();
    jest.advanceTimersByTime(OP_CAMERA_PUBLISH_MS - 1);
    expect(cb).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
