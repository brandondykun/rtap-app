import names from './semantic-token-names.json';
import { cssVars, mapColors, palette, themeColors, themes } from './tokens';

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
