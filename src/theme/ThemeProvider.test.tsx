import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

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
});
