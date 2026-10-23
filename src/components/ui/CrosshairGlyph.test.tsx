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

  it('draws no outline by default (on glass panels and buttons)', async () => {
    await renderWithProviders(<CrosshairGlyph />);
    expect(screen.queryAllByTestId('crosshair-outline')).toHaveLength(0);
  });

  it('outlines the arms and dot with a thin dark edge when asked, keeping them as thin', async () => {
    await renderWithProviders(<CrosshairGlyph outline />);
    const edges = screen.getAllByTestId('crosshair-outline');
    expect(edges).toHaveLength(4);
    for (const edge of edges) expect(edge).toHaveStyle({ backgroundColor: colors['point-symbol-halo'] });
    expect(screen.getAllByTestId('crosshair-arm')[0]).toHaveStyle({ width: 1.5, height: 14, backgroundColor: colors.text });
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ width: 5.5, borderColor: colors['point-symbol-halo'], borderWidth: 0.75 });
  });
});
