import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Crosshair } from './Crosshair';

function frameStyle() {
  return StyleSheet.flatten(screen.getByTestId('crosshair-frame').props.style);
}

describe('Crosshair', () => {
  it('centers on the whole map without a panel', async () => {
    await render(<Crosshair panel={null} />);
    expect(frameStyle()).toMatchObject({ bottom: 0, left: 0 });
  });

  it('centers in the map above a bottom sheet', async () => {
    await render(<Crosshair panel={{ side: 'bottom', size: 320 }} />);
    expect(frameStyle()).toMatchObject({ bottom: 320, left: 0 });
  });

  it('centers in the map right of a left drawer', async () => {
    await render(<Crosshair panel={{ side: 'left', size: 400 }} />);
    expect(frameStyle()).toMatchObject({ bottom: 0, left: 400 });
  });
});
