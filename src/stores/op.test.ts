import { INITIAL_OP, OP_EYE_RANGE, OP_MAX_PITCH, useOp } from '@/stores/op';

const SPOT = { lat: 47.6, lon: -122.3 };

beforeEach(() => {
  useOp.setState(INITIAL_OP);
});

describe('useOp', () => {
  it('picks then stakes an OP facing the given way at 80°', () => {
    useOp.getState().startPicking();
    expect(useOp.getState().phase).toBe('picking');

    useOp.getState().stake(SPOT, 45);
    const s = useOp.getState();
    expect(s.phase).toBe('on');
    expect(s.at).toEqual(SPOT);
    expect(s.bearing).toBe(45);
    expect(s.pitch).toBe(80);
    expect(s.groundM).toBeNull();
  });

  it('cancel ends picking only', () => {
    useOp.getState().cancel();
    expect(useOp.getState().phase).toBe('off');

    useOp.getState().stake(SPOT, 45);
    useOp.getState().cancel();
    expect(useOp.getState().phase).toBe('on');

    useOp.getState().startPicking();
    useOp.getState().cancel();
    expect(useOp.getState().phase).toBe('off');
  });

  it('look turns and tilts, wrapping bearing and clamping tilt 0–85', () => {
    useOp.getState().stake(SPOT, 350);

    useOp.getState().look(20, 0);
    expect(useOp.getState().bearing).toBe(10);

    useOp.getState().look(0, 10);
    expect(useOp.getState().pitch).toBe(OP_MAX_PITCH);
    expect(useOp.getState().pitch).toBe(85);

    useOp.getState().look(0, -200);
    expect(useOp.getState().pitch).toBe(0);

    useOp.getState().look(-20, 0);
    expect(useOp.getState().bearing).toBe(350);
  });

  it('clamps eye height to 5–250', () => {
    useOp.getState().setEye(1);
    expect(useOp.getState().eyeM).toBe(OP_EYE_RANGE[0]);
    useOp.getState().setEye(9999);
    expect(useOp.getState().eyeM).toBe(OP_EYE_RANGE[1]);
    useOp.getState().setEye(42);
    expect(useOp.getState().eyeM).toBe(42);
  });

  it('ignores non-finite inputs', () => {
    useOp.getState().stake(SPOT, 90);
    const before = useOp.getState();
    useOp.getState().look(NaN, Infinity);
    useOp.getState().setEye(NaN);
    useOp.getState().setGround(NaN);
    expect(useOp.getState()).toEqual(before);
  });

  it('sets the ground height when given a finite value', () => {
    useOp.getState().stake(SPOT, 90);
    useOp.getState().setGround(123.4);
    expect(useOp.getState().groundM).toBe(123.4);
  });

  it('exit resets everything but the eye height', () => {
    useOp.getState().setEye(42);
    useOp.getState().stake(SPOT, 90);
    useOp.getState().exit();
    expect(useOp.getState()).toMatchObject({ ...INITIAL_OP, eyeM: 42 });
  });
});
