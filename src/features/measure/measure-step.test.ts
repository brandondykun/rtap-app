import { EMPTY_MEASURE, measureStep, pickPoint, placePoint } from './measure-step';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };
const C = { lat: 38.92, lon: -77 };

describe('measure steps', () => {
  it('sets the start first, then the end, then waits for a point to be picked', () => {
    expect(measureStep(EMPTY_MEASURE)).toBe('start');
    const one = placePoint(EMPTY_MEASURE, A);
    expect(one).toEqual({ start: A, end: null, editing: null });
    expect(measureStep(one)).toBe('end');
    const two = placePoint(one, B);
    expect(two).toEqual({ start: A, end: B, editing: null });
    expect(measureStep(two)).toBe('pick');
    // Nothing picked: a tap moves nothing.
    expect(placePoint(two, C)).toBe(two);
  });

  it('moves the picked point with the next tap, then lets it go', () => {
    const two = { start: A, end: B, editing: null };
    const start = pickPoint(two, 'start');
    expect(measureStep(start)).toBe('start');
    expect(placePoint(start, C)).toEqual({ start: C, end: B, editing: null });
    const end = pickPoint(two, 'end');
    expect(measureStep(end)).toBe('end');
    expect(placePoint(end, C)).toEqual({ start: A, end: C, editing: null });
  });

  it('lets a picked point go when picked again, and picks only a point that is set', () => {
    const two = { start: A, end: B, editing: null };
    expect(pickPoint(pickPoint(two, 'end'), 'end')).toEqual(two);
    expect(pickPoint(pickPoint(two, 'end'), 'start').editing).toBe('start');
    const one = { start: A, end: null, editing: null };
    expect(pickPoint(one, 'end')).toBe(one);
    // The start can be moved before the end is set; then the end is next again.
    const moved = placePoint(pickPoint(one, 'start'), C);
    expect(moved).toEqual({ start: C, end: null, editing: null });
    expect(measureStep(moved)).toBe('end');
  });
});
