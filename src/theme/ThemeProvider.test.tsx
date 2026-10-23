import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';

import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const { name, colors } = useTheme();
  return <Text>{`${name}:${colors.accent}`}</Text>;
}

describe('ThemeProvider', () => {
  it('provides theme colors to children', async () => {
    await render(
      <ThemeProvider theme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('dark:#f59e0b')).toBeTruthy();
  });

  it('makes the see-through panels as dark as the Panel background setting', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    function Glass() {
      return <Text>{useTheme().colors['surface-glass']}</Text>;
    }
    await render(
      <ThemeProvider theme="dark">
        <Glass />
      </ThemeProvider>,
    );
    expect(screen.getByText('rgba(10, 10, 10, 0.35)')).toBeTruthy();
    for (const [level, alpha] of [['clear', 0.15], ['heavy', 0.6], ['solid', 0.9]] as const) {
      await act(async () => useSettings.getState().setPanelBackground(level));
      expect(screen.getByText(`rgba(10, 10, 10, ${alpha})`)).toBeTruthy();
    }
  });

  it('pairs each Panel background with a separator: more white over a lighter panel', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    function Divider() {
      return <Text>{useTheme().colors.divider}</Text>;
    }
    await render(
      <ThemeProvider theme="dark">
        <Divider />
      </ThemeProvider>,
    );
    expect(screen.getByText('rgba(250, 250, 249, 0.35)')).toBeTruthy();
    for (const [level, alpha] of [['clear', 0.45], ['heavy', 0.3], ['solid', 0.25]] as const) {
      await act(async () => useSettings.getState().setPanelBackground(level));
      expect(screen.getByText(`rgba(250, 250, 249, ${alpha})`)).toBeTruthy();
    }
  });
});
