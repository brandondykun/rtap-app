import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_PROFILE, useProfile } from './profile';

const stored = () => JSON.parse(Storage.getItemSync('profile') ?? '{}').state;

beforeEach(() => {
  useProfile.setState(DEFAULT_PROFILE);
});

describe('profile store', () => {
  it('starts with no callsign, not yet asked for one', () => {
    expect(useProfile.getState()).toMatchObject({ callsign: null, callsignPrompted: false });
  });

  it('saves a callsign in capitals and remembers it', () => {
    expect(useProfile.getState().setCallsign(' viper 6 ')).toBe(true);
    expect(useProfile.getState().callsign).toBe('VIPER 6');
    expect(stored()).toMatchObject({ callsign: 'VIPER 6', callsignPrompted: true });
  });

  it('rejects an invalid callsign and keeps the old one', () => {
    useProfile.getState().setCallsign('VIPER 6');
    expect(useProfile.getState().setCallsign('VIPER_6')).toBe(false);
    expect(useProfile.getState().callsign).toBe('VIPER 6');
  });

  it('clears the callsign when given an empty one', () => {
    useProfile.getState().setCallsign('VIPER 6');
    expect(useProfile.getState().setCallsign('  ')).toBe(true);
    expect(useProfile.getState().callsign).toBeNull();
  });

  it('remembers that the first-launch prompt was dismissed', () => {
    useProfile.getState().dismissCallsignPrompt();
    expect(stored()).toMatchObject({ callsign: null, callsignPrompted: true });
  });

  it('ignores a stored callsign that is not valid', async () => {
    Storage.setItemSync('profile', JSON.stringify({ state: { callsign: 'bad_one', callsignPrompted: 'yes' }, version: 1 }));
    await useProfile.persist.rehydrate();
    expect(useProfile.getState()).toMatchObject({ callsign: null, callsignPrompted: false });
  });
});
