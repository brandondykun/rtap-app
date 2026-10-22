import { screen, within } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { SETTINGS_HELP } from './settings-help';
import { SettingsMenu } from './SettingsMenu';

/** Each setting in the Settings menu: every toggle, and every section without toggles (a segmented choice), in menu order. */
async function menuSettings(): Promise<string[]> {
  await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
  return screen.getAllByTestId(/^menu-section-/).flatMap((section) => {
    const toggles = within(section).queryAllByRole('switch').map((t) => t.props.accessibilityLabel as string);
    return toggles.length > 0 ? toggles : [(section.props.testID as string).replace('menu-section-', '')];
  });
}

describe('SETTINGS_HELP', () => {
  it('explains every setting in the Settings menu, in menu order, and nothing that is gone', async () => {
    expect(SETTINGS_HELP.map((h) => h.name)).toEqual(await menuSettings());
  });

  it('gives each an explanation', () => {
    for (const h of SETTINGS_HELP) expect(h.help.length).toBeGreaterThan(10);
  });
});
