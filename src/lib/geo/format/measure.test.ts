import { formatAngle, formatDistance, refLabel } from './measure';

describe('formatAngle', () => {
  it.each([
    [69, '069°'],
    [103.4, '103°'],
    [359.6, '000°'],
    [0.4, '000°'],
  ])('%p° in degrees → %p', (deg, label) => {
    expect(formatAngle(deg, 'deg')).toBe(label);
  });

  it.each([
    [103, '1831 mils'],
    [90, '1600 mils'],
    [359.99, '0000 mils'],
  ])('%p° in mils → %p', (deg, label) => {
    expect(formatAngle(deg, 'mil')).toBe(label);
  });

  it('renders a missing bearing as an em dash', () => {
    expect(formatAngle(null, 'deg')).toBe('—');
    expect(formatAngle(null, 'mil')).toBe('—');
  });
});

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [999.4, '999 m'],
    [999.6, '1.00 km'],
    [1150, '1.15 km'],
    [12345, '12.3 km'],
    [123456, '123 km'],
  ])('%p m → %p', (m, label) => {
    expect(formatDistance(m)).toBe(label);
  });
});

describe('refLabel', () => {
  it('labels each north reference', () => {
    expect(refLabel('true')).toBe('TRUE');
    expect(refLabel('grid')).toBe('GRID');
    expect(refLabel('magnetic')).toBe('MAG');
  });
});
