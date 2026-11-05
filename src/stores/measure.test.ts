import { INITIAL_MEASURE, useMeasure } from './measure';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };

beforeEach(() => useMeasure.setState(INITIAL_MEASURE));

describe('measure store', () => {
  it('starts empty, places points and stops clearing everything', () => {
    const m = () => useMeasure.getState();
    m().startMeasure();
    expect(m()).toMatchObject({ active: true, start: null, end: null });
    m().place(A);
    m().place(B);
    expect(m()).toMatchObject({ start: A, end: B, editing: null });
    m().pick('end');
    expect(m().editing).toBe('end');
    m().stopMeasure();
    expect(m()).toMatchObject({ active: false, start: null, end: null, editing: null });
  });

  it('picks a point only while measuring', () => {
    useMeasure.setState({ start: A, end: B });
    useMeasure.getState().pick('start');
    expect(useMeasure.getState().editing).toBeNull();
  });

  it('ignores points while off and invalid points always', () => {
    useMeasure.getState().place(A);
    expect(useMeasure.getState().start).toBeNull();
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 99, lon: 0 });
    expect(useMeasure.getState().start).toBeNull();
  });
});
