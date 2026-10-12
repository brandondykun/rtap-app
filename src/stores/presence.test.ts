import { INITIAL_PRESENCE, usePresence } from './presence';

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('presence store', () => {
  it('stores a valid fix', () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    expect(usePresence.getState().selfPosition?.position).toEqual({ lat: 38.9, lon: -77 });
  });

  it.each([
    [{ lat: Number.NaN, lon: 0 }],
    [{ lat: 0, lon: Number.POSITIVE_INFINITY }],
    [{ lat: 91, lon: 0 }],
  ])('ignores an invalid fix %p', (position) => {
    usePresence.getState().setSelfPosition({ position, accuracyM: null, timestamp: 1 });
    expect(usePresence.getState().selfPosition).toBeNull();
  });

  it('stores heading and status, and resets', () => {
    usePresence.getState().setSelfHeading(42);
    usePresence.getState().setLocationStatus('granted');
    expect(usePresence.getState().selfHeading).toBe(42);
    expect(usePresence.getState().locationStatus).toBe('granted');
    usePresence.getState().reset();
    expect(usePresence.getState()).toMatchObject(INITIAL_PRESENCE);
  });
});
