import type { MapView } from '@rnmapbox/maps';

import { setFreeCamera } from './free-camera';

const cam = { at: { lat: 38.9, lon: -77 }, altitudeM: 312, pitch: 80, bearing: 45 };

function fakeMap(runNative: jest.Mock): MapView {
  return { _runNative: runNative } as unknown as MapView;
}

describe('setFreeCamera', () => {
  it('calls the native free camera with [lon, lat, altitude, pitch, bearing]', () => {
    const runNative = jest.fn().mockResolvedValue(undefined);
    setFreeCamera(fakeMap(runNative), cam);
    expect(runNative).toHaveBeenCalledWith('setFreeCamera', [[-77, 38.9, 312, 80, 45]]);
  });

  it('does nothing without a map', () => {
    expect(() => setFreeCamera(null, cam)).not.toThrow();
  });

  it('swallows a rejected native call', async () => {
    const runNative = jest.fn().mockRejectedValue(new Error('boom'));
    expect(() => setFreeCamera(fakeMap(runNative), cam)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});
