import { redactLocation } from './redact';

describe('redactLocation', () => {
  it('redacts MGRS grids with or without spaces, at any precision', () => {
    expect(redactLocation('bad grid 18SUJ2348306479')).toBe('bad grid [grid]');
    expect(redactLocation('bad grid 18S UJ 23483 06479 here')).toBe('bad grid [grid] here');
    expect(redactLocation('zone 4QFJ')).toBe('zone [grid]');
    expect(redactLocation('typed 18suj234064')).toBe('typed [grid]');
  });

  it('redacts precise decimal coordinates', () => {
    expect(redactLocation('at 38.8977, -77.0365')).toBe('at [coord], [coord]');
    expect(redactLocation('{"lat":38.897712}')).toBe('{"lat":[coord]}');
  });

  it('leaves ordinary messages alone', () => {
    expect(redactLocation('[menu] no menu registered for point-actions')).toBe('[menu] no menu registered for point-actions');
    expect(redactLocation('took 12.5 ms, version 1.0.0')).toBe('took 12.5 ms, version 1.0.0');
  });
});
