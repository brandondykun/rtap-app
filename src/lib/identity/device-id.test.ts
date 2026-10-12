import { getDeviceId } from './device-id';

describe('getDeviceId', () => {
  it('returns a stable UUID', () => {
    const first = getDeviceId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(first);
  });
});
