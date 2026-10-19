import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { Crosshair } from './Crosshair';

function frameStyle() {
  return StyleSheet.flatten(screen.getByTestId('crosshair-frame').props.style);
}

describe('Crosshair', () => {
  it('is the app crosshair: white arms, amber dot', async () => {
    await renderWithProviders(<Crosshair panel={null} />);
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ backgroundColor: themeColors('dark').accent });
    for (const arm of screen.getAllByTestId('crosshair-arm')) expect(arm).toHaveStyle({ backgroundColor: themeColors('dark').text });
  });

  it('centers on the whole map without a panel', async () => {
    await renderWithProviders(<Crosshair panel={null} />);
    expect(frameStyle()).toMatchObject({ bottom: 0, left: 0 });
  });

  it('centers in the map above a bottom sheet', async () => {
    await renderWithProviders(<Crosshair panel={{ side: 'bottom', size: 320 }} />);
    expect(frameStyle()).toMatchObject({ bottom: 320, left: 0 });
  });

  it('centers in the map right of a left drawer', async () => {
    await renderWithProviders(<Crosshair panel={{ side: 'left', size: 400 }} />);
    expect(frameStyle()).toMatchObject({ bottom: 0, left: 400 });
  });
});
