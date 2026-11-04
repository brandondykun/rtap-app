import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { Toolbar } from './Toolbar';
import { HELP_GROUPS, TOOLBAR_HELP } from './toolbar-help';

describe('TOOLBAR_HELP', () => {
  it('describes every toolbar button exactly once', async () => {
    await renderWithProviders(<Toolbar landscape activeTool={null} />);
    const buttons = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(TOOLBAR_HELP.map((h) => h.label).sort()).toEqual([...buttons].sort());
  });

  it('groups the buttons as on the About page, in this order', () => {
    const byGroup = (g: string) => TOOLBAR_HELP.filter((h) => h.group === g).map((h) => h.label);
    expect(HELP_GROUPS.map((g) => g.title)).toEqual(['Plot on the map', 'Read the map', 'App']);
    expect(byGroup('plot')).toEqual(['UNIT', 'POINT', 'LINE', 'POLYGON', 'PLOT']);
    expect(byGroup('read')).toEqual(['MEASURE', 'AVG', 'LAYERS', 'LABELS', '3D', 'OP']);
    expect(TOOLBAR_HELP.find((h) => h.label === 'OP')?.help).toBe('Look out over the 3D map from a spot you pick.');
    expect(byGroup('app')).toEqual(['Menu']);
  });

  it('gives each button an icon and a short line of help', () => {
    for (const h of TOOLBAR_HELP) {
      expect(h.icon).toBeTruthy();
      expect(h.help.length).toBeGreaterThan(10);
    }
    expect(TOOLBAR_HELP.find((h) => h.label === 'UNIT')?.help).toBe('Place a unit, then pick its affiliation and type.');
    expect(TOOLBAR_HELP.find((h) => h.label === 'Menu')?.help).toBe('Switch missions, change settings or open this page.');
    expect(TOOLBAR_HELP.some((h) => 'accent' in h)).toBe(false);
  });
});
