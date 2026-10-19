import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';

import { renderWithProviders } from '@/test-utils/render';

import { MissionNameForm } from './MissionNameForm';

const props = {
  title: 'New mission',
  name: 'Mission 1',
  onChangeName: jest.fn(),
  submitLabel: 'Create',
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  error: null,
};

afterEach(() => jest.restoreAllMocks());

describe('MissionNameForm', () => {
  it('keeps its content inside the side safe areas (landscape notch and home indicator)', async () => {
    jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 0, right: 47, bottom: 21, left: 59 });
    await renderWithProviders(<MissionNameForm {...props} />);
    const style = StyleSheet.flatten(screen.getByTestId('mission-name-form').props.style);
    expect(style.paddingLeft).toBe(59 + 16);
    expect(style.paddingRight).toBe(47 + 16);
  });

  it('keeps the usual 16 pt sides without insets (portrait)', async () => {
    jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 47, right: 0, bottom: 34, left: 0 });
    await renderWithProviders(<MissionNameForm {...props} />);
    const style = StyleSheet.flatten(screen.getByTestId('mission-name-form').props.style);
    expect([style.paddingLeft, style.paddingRight]).toEqual([16, 16]);
  });
});
