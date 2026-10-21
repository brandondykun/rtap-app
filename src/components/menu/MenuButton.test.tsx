import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { MenuButton } from './MenuButton';

describe('MenuButton', () => {
  it('is raised and bordered by default', async () => {
    await renderWithProviders(<MenuButton label="Exit" icon="close" onPress={() => {}} />);
    const button = screen.getByLabelText('Exit').props.className as string;
    expect(button).toContain('bg-surface-raised');
    expect(button).toContain('border-border');
  });

  it('floats see-through over the map when glass, with outlined text', async () => {
    await renderWithProviders(<MenuButton glass compact label="Exit" icon="close" onPress={() => {}} />);
    const button = screen.getByLabelText('Exit').props.className as string;
    expect(button).toContain('bg-surface-glass');
    expect(button).not.toContain('border');
    expect(screen.getByText('Exit')).toHaveStyle({ textShadowRadius: 3 });
  });
});
