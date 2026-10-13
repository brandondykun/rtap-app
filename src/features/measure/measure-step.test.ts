import { EMPTY_MEASURE, placePoint } from './measure-step';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };
const C = { lat: 38.92, lon: -77 };

describe('measure steps', () => {
  it('sets the start first, then the end, then moves the end', () => {
    const one = placePoint(EMPTY_MEASURE, A);
    expect(one).toEqual({ start: A, end: null });
    const two = placePoint(one, B);
    expect(two).toEqual({ start: A, end: B });
    expect(placePoint(two, C)).toEqual({ start: A, end: C });
  });
});
