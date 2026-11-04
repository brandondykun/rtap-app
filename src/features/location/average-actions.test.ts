import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import { useToast } from '@/stores/toast';

import { AVERAGE_START_MESSAGE, startAveraging } from './average-actions';

beforeEach(() => {
  useMyLocation.setState(DEFAULT_MY_LOCATION);
  useGpsAverage.setState(INITIAL_GPS_AVERAGE);
  useToast.setState({ toast: null });
});

describe('startAveraging', () => {
  it('starts averaging on GPS and shows the sticky keep-still message', () => {
    expect(startAveraging()).toBe(true);
    expect(useGpsAverage.getState().phase).toBe('averaging');
    expect(useToast.getState().toast).toEqual(expect.objectContaining({ message: AVERAGE_START_MESSAGE, kind: 'info', sticky: true }));
  });

  it('stays off on the Manual source and says why', () => {
    useMyLocation.setState({ source: 'manual' });
    expect(startAveraging()).toBe(false);
    expect(useGpsAverage.getState().phase).toBe('off');
    expect(useToast.getState().toast).toEqual(expect.objectContaining({ message: 'Averaging needs GPS. Switch your location to GPS first.', sticky: false }));
  });
});
