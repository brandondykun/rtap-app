import { isTileLoadFailure } from './mapbox-logs';

describe('isTileLoadFailure', () => {
  it('matches a rate-limited tile', () => {
    expect(isTileLoadFailure({ level: 'error', tag: '', message: 'MapLoad error Failed to load tile: HTTP status code 429. Too Many Requests' })).toBe(true);
  });

  it('matches a tile that failed offline, with or without a tag', () => {
    expect(isTileLoadFailure({ level: 'error', tag: 'Mbgl-HttpRequest', message: 'Failed to load tile: The Internet connection appears to be offline.' })).toBe(true);
    expect(isTileLoadFailure({ level: 'warning', tag: '', message: 'MapLoad error Failed to load tile: HTTP status code 503' })).toBe(true);
  });

  it('leaves other Mapbox errors alone', () => {
    expect(isTileLoadFailure({ level: 'error', tag: '', message: 'MapLoad error Failed to load style: HTTP status code 401' })).toBe(false);
    expect(isTileLoadFailure({ level: 'error', tag: '', message: 'Layer quick-plot-reticle is not in style' })).toBe(false);
  });
});
