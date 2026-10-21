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

  it('nests its buttons concentrically: 16 pt corners less 1 pt border and 7 pt padding is their 8 pt', async () => {
    await renderWithProviders(
      <MapHintBar testID="hint" hint="Tap the map">
        <MenuButton compact label="Cancel" icon="close" onPress={() => {}} />
      </MapHintBar>,
    );
    const bar = screen.getByTestId('hint').props.className as string;
    expect(bar).toMatch(/\brounded-2xl\b/);
    expect(bar).toMatch(/(^| )border( |$)/);
    expect(bar).toMatch(/\bp-\[7px\]/);
    expect(screen.getByLabelText('Cancel').props.className).toMatch(/\brounded-lg\b/);
  });
});
