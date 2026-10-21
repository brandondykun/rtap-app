import { screen } from '@testing-library/react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { renderWithProviders } from '@/test-utils/render';

import { MapHintBar } from './MapHintBar';

describe('MapHintBar', () => {
  it('is see-through, keeps its amber border and outlines the hint', async () => {
    await renderWithProviders(
      <MapHintBar testID="hint" hint="Tap the map">
        <MenuButton compact label="Cancel" icon="close" onPress={() => {}} />
      </MapHintBar>,
    );
    const bar = screen.getByTestId('hint').props.className as string;
    expect(bar).toContain('bg-surface-glass');
    expect(bar).toContain('border-accent');
    expect(screen.getByText('Tap the map')).toHaveStyle({ textShadowRadius: 3 });
  });
});
