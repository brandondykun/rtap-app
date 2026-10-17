import { INITIAL_MAP_CHROME, useMapChrome } from './map-chrome';

beforeEach(() => useMapChrome.setState(INITIAL_MAP_CHROME));

describe('map chrome', () => {
  it('clears the card size only for the slot that reported it', () => {
    const chrome = () => useMapChrome.getState();
    // Rotating moves the card to a new slot: the new slot can report before the old one unmounts.
    chrome().setSelfCard({ width: 250, height: 56 }, 'landscape-slot');
    chrome().setSelfCard({ width: 240, height: 56 }, 'portrait-slot');
    chrome().clearSelfCard('landscape-slot');
    expect(chrome().selfCard).toEqual({ width: 240, height: 56 });
    chrome().clearSelfCard('portrait-slot');
    expect(chrome().selfCard).toEqual({ width: 0, height: 0 });
  });

  it('keeps the readout size separate from your grid card size', () => {
    const chrome = () => useMapChrome.getState();
    chrome().setSelfCard({ width: 250, height: 56 }, 'slot');
    chrome().setReadoutCard({ width: 200, height: 52 });
    chrome().clearSelfCard('slot');
    expect(chrome().readoutCard).toEqual({ width: 200, height: 52 });
    chrome().clearReadoutCard();
    expect(chrome().readoutCard).toEqual({ width: 0, height: 0 });
  });
});
