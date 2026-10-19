import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { Toolbar } from './Toolbar';
import { TOOLBAR_HELP } from './toolbar-help';

describe('TOOLBAR_HELP', () => {
  it('describes every toolbar button, in toolbar order', async () => {
    await renderWithProviders(<Toolbar landscape activeTool={null} />);
    const buttons = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(TOOLBAR_HELP.map((h) => h.label)).toEqual(buttons);
  });

  it('gives each button an icon and a sentence of help', () => {
    for (const h of TOOLBAR_HELP) {
      expect(h.icon).toBeTruthy();
      expect(h.help.length).toBeGreaterThan(20);
    }
  });
});
