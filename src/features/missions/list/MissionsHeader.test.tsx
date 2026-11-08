import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { MissionsHeader } from './MissionsHeader';

const props = {
  subtitle: '3 missions',
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
    expect(screen.getByTestId('missions-title')).toHaveTextContent(/Missions.*3 missions/);
    expect(classes('missions-controls')).toContain('shrink-0');
    expect(screen.getByTestId('missions-controls')).toHaveTextContent(/Recent.*Name.*Most items.*New/);
  });

  it('keeps the dev button beside MISSIONS, not between the subtitle and the chips', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} />);
    expect(screen.getByTestId('missions-title-row')).toHaveTextContent(/Missions.*Seed 5k/);
  });

  it('while searching, shows only MISSIONS and gives the rest of the row to the search field', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} query="" />);
    expect(classes('missions-controls')).toContain('flex-1');
    // The title only takes its own width, so the field never slides over it.
    expect(classes('missions-title')).toContain('shrink-0');
    expect(classes('missions-title')).not.toContain('flex-1');
    // The subtitle and dev button hide but keep their room, so the row keeps its height and New stays still.
    expect(screen.queryByText('Seed 5k')).toBeNull();
    expect(screen.queryByText('3 missions')).toBeNull();
    const hidden = screen.getAllByTestId('missions-hidden', { includeHiddenElements: true });
    expect(hidden.map((h) => h.props.className)).toEqual(['opacity-0', 'opacity-0']);
    for (const h of hidden) expect(h.props.pointerEvents).toBe('none');
    expect(screen.getByText('3 missions', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Search by name')).toBeTruthy();
  });

  it('lets the dev button wrap under MISSIONS rather than overlap when the title column is narrow', async () => {
    await renderWithProviders(<MissionsHeader landscape {...props} />);
    expect(classes('missions-title-row')).toContain('flex-wrap');
  });
});
