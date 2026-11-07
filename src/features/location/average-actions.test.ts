import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { useToast } from '@/stores/toast';

import { AVERAGE_START_MESSAGE, AVERAGE_START_TITLE, startAveraging } from './average-actions';

beforeEach(() => {
  useMyLocation.setState(DEFAULT_MY_LOCATION);
  useGpsAverage.setState(INITIAL_GPS_AVERAGE);
  usePresence.setState(INITIAL_PRESENCE);
  useToast.setState({ toast: null });
});

describe('startAveraging', () => {
  it('starts averaging on GPS and shows the sticky keep-still message', () => {
    expect(startAveraging()).toBe(true);
    expect(useGpsAverage.getState().phase).toBe('averaging');
    expect(useToast.getState().toast).toEqual(expect.objectContaining({ title: AVERAGE_START_TITLE, message: AVERAGE_START_MESSAGE, kind: 'average', sticky: true }));
  });

  it('stays off on the Manual source and says why', () => {
    useMyLocation.setState({ source: 'manual' });
    expect(startAveraging()).toBe(false);
    expect(useGpsAverage.getState().phase).toBe('off');
    expect(useToast.getState().toast).toEqual(expect.objectContaining({ message: 'Averaging needs GPS. Switch your location to GPS first.', sticky: false }));
  });

  it.each(['denied', 'unavailable'] as const)('stays off while location is %s and says why', (status) => {
    usePresence.setState({ locationStatus: status });
    expect(startAveraging()).toBe(false);
    expect(useGpsAverage.getState().phase).toBe('off');
    expect(useToast.getState().toast).toEqual(expect.objectContaining({ message: 'Averaging needs GPS. Turn on location first.', sticky: false }));
  });

  it('hides the keep-still message when Average mode turns off, but not while paused', () => {
    startAveraging();
    useGpsAverage.getState().pause(1000);
    expect(useToast.getState().toast?.message).toBe(AVERAGE_START_MESSAGE);
    useGpsAverage.getState().stop();
    expect(useToast.getState().toast).toBeNull();
  });

  it('leaves another toast that replaced the keep-still message alone', () => {
    startAveraging();
    useToast.getState().show('Something else', 'info', { sticky: true });
    useGpsAverage.getState().stop();
    expect(useToast.getState().toast?.message).toBe('Something else');
  });

  it('hides the message of a restarted average too', () => {
    startAveraging();
    startAveraging();
    useGpsAverage.getState().stop();
    expect(useToast.getState().toast).toBeNull();
  });
});
