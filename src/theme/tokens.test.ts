import names from './semantic-token-names.json';
import { cssVars, GRID_SHADES, gridShadeColors, mapColors, palette, themeColors, themes } from './tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../../tailwind.config.js');

describe('theme tokens', () => {
  it('defines every semantic token in every theme', () => {
    for (const theme of Object.values(themes)) {
      expect(Object.keys(theme).sort()).toEqual([...names].sort());
    }
  });

  it('only uses Tailwind palette colors', () => {
    for (const theme of Object.values(themes)) {
      for (const value of Object.values(theme)) {
        const name = typeof value === 'string' ? value : value.color;
        expect(palette).toHaveProperty(name);
      }
    }
  });

  it('resolves solid and translucent colors', () => {
    const colors = themeColors('dark');
    expect(colors.surface).toBe('#1c1917');
    expect(colors.accent).toBe('#f59e0b');
    expect(colors['surface-chrome']).toBe('rgba(10, 10, 10, 0.9)');
  });

  it('offers grid shades from white (the grid as it was) to black, with a dark outline on light shades and a light one on dark', () => {
    expect(GRID_SHADES).toEqual(['white', 'light-gray', 'gray', 'dark-gray', 'black']);
    expect(gridShadeColors('white')).toEqual({ line: themeColors('dark')['map-label-text'], halo: themeColors('dark')['point-symbol-halo'] });
    expect(gridShadeColors('light-gray')).toEqual({ line: '#d6d3d1', halo: '#0a0a0a' });
    expect(gridShadeColors('gray')).toEqual({ line: '#78716c', halo: '#0a0a0a' });
    expect(gridShadeColors('dark-gray')).toEqual({ line: '#44403c', halo: '#fafaf9' });
    expect(gridShadeColors('black')).toEqual({ line: '#0a0a0a', halo: '#fafaf9' });
  });

  it('makes success a bright green (green-400), so Valid stands out on the dark panels', () => {
    expect(themeColors('dark').success).toBe('#4ade80');
  });

  it('sets the see-through panel color to the given alpha (0.35 by default)', () => {
    expect(themeColors('dark')['surface-glass']).toBe('rgba(10, 10, 10, 0.35)');
    expect(themeColors('dark', 0.6)['surface-glass']).toBe('rgba(10, 10, 10, 0.6)');
    expect(cssVars('dark', 0.6)['--surface-glass']).toBe('rgba(10, 10, 10, 0.6)');
    expect(themeColors('dark', 0.6)['surface-chrome']).toBe('rgba(10, 10, 10, 0.9)');
  });

  it('exposes css variables per token', () => {
    expect(cssVars('dark')['--hostile']).toBe('#f87171');
  });

  it('gives map styles the same colors as the UI', () => {
    expect(mapColors('dark')).toEqual(themeColors('dark'));
  });

  it('registers every semantic token as a Tailwind color', () => {
    const colors = tailwindConfig.theme.extend.colors;
    for (const name of names) expect(colors[name]).toBe(`var(--${name})`);
  });
});
