import { updateLabel } from './update-label';

describe('updateLabel', () => {
  it('names the channel and a short update id when running a downloaded update', () => {
    expect(updateLabel({ isEnabled: true, channel: 'production', updateId: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d', isEmbeddedLaunch: false })).toBe(
      'production · update 1a2b3c4d',
    );
  });

  it('says built-in when running what shipped with the store build', () => {
    expect(updateLabel({ isEnabled: true, channel: 'preview', updateId: '1a2b3c4d-5e6f', isEmbeddedLaunch: true })).toBe('preview · built-in');
  });

  it('says built-in alone when updates are off (development builds) or there is no channel', () => {
    expect(updateLabel({ isEnabled: false, channel: null, updateId: null, isEmbeddedLaunch: true })).toBe('built-in');
    expect(updateLabel({ isEnabled: true, channel: null, updateId: 'abc', isEmbeddedLaunch: false })).toBe('update abc');
  });
});
