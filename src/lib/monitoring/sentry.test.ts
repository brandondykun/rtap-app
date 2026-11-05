import * as Sentry from '@sentry/react-native';

import { reportSuspect } from './sentry';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), wrap: (c: unknown) => c }));
jest.mock('expo-updates', () => ({}));

describe('reportSuspect', () => {
  it('warns in the Metro log while developing, where Sentry is off', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    reportSuspect('Menu closed', { sinceItemPressMs: 650 });
    expect(warn).toHaveBeenCalledWith('Menu closed', { sinceItemPressMs: 650 });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
