import { INITIAL_INTERACTION, useInteraction } from './interaction';

beforeEach(() => useInteraction.setState(INITIAL_INTERACTION));

describe('interaction store', () => {
  it('starts with no camera and follow off', () => {
    const s = useInteraction.getState();
    expect(s.cameraCenter).toBeNull();
    expect(s.followMode).toBe(false);
  });

  it('records a camera snapshot', () => {
    useInteraction.getState().setCamera({ center: { lat: 1, lon: 2 }, zoom: 12, bearing: 30 });
    const s = useInteraction.getState();
    expect(s.cameraCenter).toEqual({ lat: 1, lon: 2 });
    expect(s.cameraZoom).toBe(12);
    expect(s.cameraBearing).toBe(30);
  });

  it('resets everything', () => {
    useInteraction.getState().setFollowMode(true);
    useInteraction.getState().setCamera({ center: { lat: 1, lon: 2 }, zoom: 12, bearing: 30 });
    useInteraction.getState().reset();
    expect(useInteraction.getState()).toMatchObject(INITIAL_INTERACTION);
  });
});
