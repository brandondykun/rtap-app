import { createLatestThrottle } from './frame-throttle';

describe('createLatestThrottle', () => {
  it('delivers only the latest value once per scheduled frame', () => {
    const queue: (() => void)[] = [];
    const fn = jest.fn();
    const throttled = createLatestThrottle(fn, (cb) => queue.push(cb));

    throttled(1);
    throttled(2);
    throttled(3);
    expect(queue).toHaveLength(1);
    expect(fn).not.toHaveBeenCalled();

    queue.shift()!();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(3);

    throttled(4);
    expect(queue).toHaveLength(1);
    queue.shift()!();
    expect(fn).toHaveBeenLastCalledWith(4);
  });
});
