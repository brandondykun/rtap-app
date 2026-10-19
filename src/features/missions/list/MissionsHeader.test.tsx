import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { MissionsHeader } from './MissionsHeader';

const props = {
  subtitle: '3 missions · 43 units plotted',
  showControls: true,
  sort: 'recent' as const,
  onSort: jest.fn(),
  query: null,
  onQuery: jest.fn(),
  onNew: jest.fn(),
  extra: <Text>Seed 5k</Text>,
};

const classes = (testID: string) => String(screen.getByTestId(testID).props.className ?? '');

describe('MissionsHeader in landscape', () => {
  // Layout itself cannot be measured under Jest; these pin the wrapping structure that keeps the
  // title, subtitle, dev button, chips and buttons from overlapping on narrow landscape screens.
  it('wraps the controls onto a second row instead of overlapping the title when space runs out', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} />);
    expect(classes('missions-header')).toContain('flex-wrap');
    // The title group sizes to its content (no flex-1), so the controls wrap rather than squeezing it.
    expect(classes('missions-title')).toContain('flex-wrap');
    expect(classes('missions-title')).not.toContain('flex-1');
    expect(classes('missions-controls')).toContain('grow');
  });

  it('keeps the dev button with the title, ahead of the controls', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} />);
    const title = screen.getByTestId('missions-title');
    expect(title).toHaveTextContent(/MissionsSeed 5k|Missions.*Seed 5k/);
    expect(screen.getByTestId('missions-controls')).toHaveTextContent(/Recent/);
  });
});
