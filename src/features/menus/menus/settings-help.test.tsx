import { screen, within } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { SETTINGS_HELP } from './settings-help';
import { SettingsMenu } from './SettingsMenu';

/**
 * Each setting in the Settings menu, in menu order: a section's segmented choice (by the section's name, or the
 * section itself when it has no toggles), then its toggles.
 */
async function menuSettings(): Promise<string[]> {
  await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
  return screen.getAllByTestId(/^menu-section-/).flatMap((section) => {
    const name = (section.props.testID as string).replace('menu-section-', '');
    const toggles = within(section).queryAllByRole('switch').map((t) => t.props.accessibilityLabel as string);
    const choice = within(section).queryAllByRole('button').some((b) => b.props.accessibilityState?.selected !== undefined);
    return [...(choice || toggles.length === 0 ? [name] : []), ...toggles];
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
