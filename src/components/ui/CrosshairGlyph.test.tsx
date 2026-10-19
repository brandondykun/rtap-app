import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { CrosshairGlyph } from './CrosshairGlyph';

const colors = themeColors('dark');

describe('CrosshairGlyph', () => {
  it('is white with an amber center dot by default (the app-wide crosshair look)', async () => {
    await renderWithProviders(<CrosshairGlyph />);
    for (const arm of screen.getAllByTestId('crosshair-arm')) expect(arm).toHaveStyle({ backgroundColor: colors.text });
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ backgroundColor: colors.accent });
  });

  it('scales to any size', async () => {
    await renderWithProviders(<CrosshairGlyph size={76} />);
    expect(screen.getByTestId('crosshair-glyph')).toHaveStyle({ width: 76, height: 76 });
    expect(screen.getAllByTestId('crosshair-arm')[0]).toHaveStyle({ height: 28 });
  });

  it('takes one color for both arms and dot where amber would vanish (on an amber button)', async () => {
    await renderWithProviders(<CrosshairGlyph color={colors['on-accent']} dotColor={colors['on-accent']} />);
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ backgroundColor: colors['on-accent'] });
  });
});
