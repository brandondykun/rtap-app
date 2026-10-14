import { INITIAL_QUICK_PLOT, useQuickPlot } from './quick-plot';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.95, lon: -77 };

beforeEach(() => useQuickPlot.setState(INITIAL_QUICK_PLOT));

describe('quick plot store', () => {
  it('opens the entry, plots one point (replacing the last) and closes', () => {
    const q = () => useQuickPlot.getState();
    q().open();
    expect(q()).toMatchObject({ entryOpen: true, temp: null });
    q().plot(A);
    expect(q()).toMatchObject({ entryOpen: false, temp: A });
    q().open();
    q().plot(B);
    expect(q().temp).toEqual(B);
    q().close();
    expect(q()).toMatchObject({ entryOpen: false, temp: null });
  });

  it('ignores invalid coordinates', () => {
    useQuickPlot.getState().plot({ lat: 99, lon: 0 });
    expect(useQuickPlot.getState().temp).toBeNull();
  });
});
