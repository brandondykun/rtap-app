import { formatLatLon, formatMgrs } from './coords';

describe('formatMgrs', () => {
  it('spaces a compact reference', () => {
    expect(formatMgrs('18SUJ2339407395')).toBe('18S UJ 23394 07395');
  });

  it('spaces a reduced-precision reference', () => {
    expect(formatMgrs('18SUJ233073')).toBe('18S UJ 233 073');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatMgrs('nope')).toBe('nope');
  });
});

describe('formatLatLon', () => {
  it('formats hemispheres', () => {
    expect(formatLatLon({ lat: 38.8977, lon: -77.0365 })).toBe('38.89770° N 77.03650° W');
    expect(formatLatLon({ lat: -33.9, lon: 18.4 })).toBe('33.90000° S 18.40000° E');
  });
});
