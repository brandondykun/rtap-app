import { measureReadout } from './measure-readout';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };
const date = new Date('2026-10-13T00:00:00Z');

describe('measureReadout', () => {
  it('formats distance and bearing in the user unit and north reference', () => {
    expect(measureReadout(A, B, { angleUnit: 'deg', northRef: 'true', declinationOverrideDeg: null }, date)).toBe('1.11 km · 000° TRUE');
    expect(measureReadout(A, B, { angleUnit: 'mil', northRef: 'true', declinationOverrideDeg: null }, date)).toBe('1.11 km · 0000 mils TRUE');
  });

  it('reads a zero-length measurement without a bearing', () => {
    expect(measureReadout(A, A, { angleUnit: 'deg', northRef: 'grid', declinationOverrideDeg: null }, date)).toBe('0 m · — GRID');
  });
});
