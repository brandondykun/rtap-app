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
  // Layout itself cannot be measured under Jest; these pin the structure that keeps the title,
  // subtitle, dev button, chips and buttons on one row without overlapping.
  it('stacks the subtitle under MISSIONS and keeps the controls on the same row', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} />);
    expect(classes('missions-header')).toContain('flex-row');
    expect(classes('missions-header')).not.toContain('flex-wrap');
    // The title column takes the room the controls leave, so its text wraps instead of running under them.
    expect(classes('missions-title')).toContain('flex-1');
    expect(classes('missions-title')).not.toContain('flex-row');
    expect(screen.getByTestId('missions-title')).toHaveTextContent(/Missions.*3 missions · 43 units plotted/);
    expect(classes('missions-controls')).toContain('shrink-0');
    expect(screen.getByTestId('missions-controls')).toHaveTextContent(/Recent.*Name.*Most items.*New/);
  });

  it('keeps the dev button beside MISSIONS, not between the subtitle and the chips', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} />);
    expect(screen.getByTestId('missions-title-row')).toHaveTextContent(/Missions.*Seed 5k/);
  });

  it('lets the search field take the row while searching', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} query="" />);
    expect(classes('missions-controls')).toContain('flex-1');
  });
});
