import { screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { CrosshairGlyph } from './CrosshairGlyph';

const colors = themeColors('dark');

afterEach(() => jest.restoreAllMocks());

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

  it('outlines the arms and dot with a dark edge one device pixel wide', async () => {
    await renderWithProviders(<CrosshairGlyph outline />);
    const edges = screen.getAllByTestId('crosshair-outline');
    expect(edges).toHaveLength(4);
    for (const edge of edges) expect(edge).toHaveStyle({ backgroundColor: colors['point-symbol-halo'] });
    expect(screen.getAllByTestId('crosshair-arm')[0]).toHaveStyle({ backgroundColor: colors.text });
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ borderColor: colors['point-symbol-halo'], borderWidth: 1 / PixelRatio.get() });
  });

  it.each([1, 2, 3])('centres every part on whole device pixels at %px, so the edges are even on both sides', async (scale) => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(scale);
    await renderWithProviders(<CrosshairGlyph outline />);
    const box = StyleSheet.flatten(screen.getByTestId('crosshair-glyph').props.style).width as number;
    const style = (id: string, i: number) => StyleSheet.flatten(screen.getAllByTestId(id)[i].props.style);
    const onPixels = (v: number) => expect(Math.abs(v * scale - Math.round(v * scale))).toBeLessThan(1e-9);
    onPixels(box);
    for (let i = 0; i < 4; i++) {
      const arm = style('crosshair-arm', i);
      const edge = style('crosshair-outline', i);
      const [at, across] = i < 2 ? ['left', 'width'] : ['top', 'height'];
      for (const v of [arm[at], arm[across], edge[at], edge[across]]) onPixels(v);
      // Centred exactly, with the same edge on both sides.
      expect(arm[at] * 2 + arm[across]).toBeCloseTo(box, 9);
      expect(arm[at] - edge[at]).toBeCloseTo(1 / scale, 9);
      expect(edge[at] + edge[across] - (arm[at] + arm[across])).toBeCloseTo(1 / scale, 9);
    }
    const dot = style('crosshair-dot', 0);
    onPixels(dot.left);
    expect(dot.left * 2 + dot.width).toBeCloseTo(box, 9);
    expect(dot.top * 2 + dot.height).toBeCloseTo(box, 9);
  });
});
