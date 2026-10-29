/**
 * Single source of truth for color. Palette entries are Tailwind CSS v3 colors, copied by
 * hand; only this folder may reference them. Everything else uses semantic tokens.
 */
export const palette = {
  'stone-50': '#fafaf9',
  'stone-300': '#d6d3d1',
  'stone-400': '#a8a29e',
  'stone-500': '#78716c',
  'stone-700': '#44403c',
  'stone-800': '#292524',
  'stone-900': '#1c1917',
  'neutral-950': '#0a0a0a',
  'amber-500': '#f59e0b',
  'amber-950': '#451a03',
  'green-300': '#86efac',
  'green-400': '#4ade80',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-950': '#450a0a',
  'sky-300': '#7dd3fc',
  'sky-400': '#38bdf8',
  'yellow-300': '#fde047',
} as const;

export type PaletteName = keyof typeof palette;
type TokenValue = PaletteName | { color: PaletteName; alpha: number };

const dark = {
  surface: 'stone-900',
  'surface-chrome': { color: 'neutral-950', alpha: 0.9 },
  /** See-through backing for everything floating over the map, so it shows through. Its alpha follows the Panel background setting (themeColors). */
  'surface-glass': { color: 'neutral-950', alpha: 0.35 },
  'surface-input': 'neutral-950',
  'surface-raised': 'stone-800',
  border: 'stone-700',
  /** Faint lines inside a panel (the drawer's notch edge, the header's scroll divider): a step off the surface. */
  'border-subtle': 'stone-800',
  /** Separator lines on the see-through panels (the CTR/ME dock, the toolbar): faint white. Its alpha follows the Panel background setting (themeColors). */
  divider: { color: 'stone-50', alpha: 0.35 },
  /** The toolbar separator while tools are scrolled out of sight behind it. */
  'divider-lit': { color: 'stone-50', alpha: 0.7 },
  text: 'stone-50',
  'text-muted': 'stone-400',
  accent: 'amber-500',
  'accent-subtle': 'amber-950',
  'on-accent': 'neutral-950',
  success: 'green-400',
  danger: 'red-500',
  /** Fill behind a destructive action (Delete), as accent-subtle is to accent. */
  'danger-subtle': 'red-950',
  friendly: 'sky-300',
  hostile: 'red-400',
  neutral: 'green-300',
  unknown: 'yellow-300',
  self: 'sky-400',
  'map-label-bg': { color: 'neutral-950', alpha: 0.85 },
  'map-label-text': 'stone-50',
  /** Halo around control-measure point symbols (build-time only); their lines use `friendly`. */
  'point-symbol-halo': 'neutral-950',
} as const satisfies Record<string, TokenValue>;

export type SemanticToken = keyof typeof dark;
export const themes = { dark } as const satisfies Record<string, Record<SemanticToken, TokenValue>>;
export type ThemeName = keyof typeof themes;

function resolve(value: TokenValue): string {
  if (typeof value === 'string') return palette[value];
  const hex = palette[value.color];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${value.alpha})`;
}

/** `glassAlpha` and `dividerAlpha` replace the theme's alphas for `surface-glass` and `divider` (the Panel background setting). */
export function themeColors(name: ThemeName, glassAlpha?: number, dividerAlpha?: number): Record<SemanticToken, string> {
  const theme: Record<SemanticToken, TokenValue> = { ...themes[name] };
  const glass = themes[name]['surface-glass'];
  if (glassAlpha !== undefined) theme['surface-glass'] = { color: glass.color, alpha: glassAlpha };
  if (dividerAlpha !== undefined) theme.divider = { color: themes[name].divider.color, alpha: dividerAlpha };
  return Object.fromEntries(
    Object.entries(theme).map(([token, value]) => [token, resolve(value)]),
  ) as Record<SemanticToken, string>;
}

export function cssVars(name: ThemeName, glassAlpha?: number, dividerAlpha?: number): Record<string, string> {
  return Object.fromEntries(Object.entries(themeColors(name, glassAlpha, dividerAlpha)).map(([token, color]) => [`--${token}`, color]));
}

/** Shades for the MGRS grid (the Grid color setting), lightest first. */
export type GridShade = 'white' | 'light-gray' | 'gray' | 'dark-gray' | 'black';
export const GRID_SHADES: readonly GridShade[] = ['white', 'light-gray', 'gray', 'dark-gray', 'black'];

/** Each shade's line and label color, and the label outline: dark under light shades, light under dark ones. */
const gridShades: Record<GridShade, { line: PaletteName; halo: PaletteName }> = {
  white: { line: 'stone-50', halo: 'neutral-950' },
  'light-gray': { line: 'stone-300', halo: 'neutral-950' },
  gray: { line: 'stone-500', halo: 'neutral-950' },
  'dark-gray': { line: 'stone-700', halo: 'stone-50' },
  black: { line: 'neutral-950', halo: 'stone-50' },
};

export function gridShadeColors(shade: GridShade): { line: string; halo: string } {
  const { line, halo } = gridShades[shade];
  return { line: palette[line], halo: palette[halo] };
}

/** Raw colors for Mapbox layer styles and build scripts; identical to the UI colors. */
export function mapColors(name: ThemeName): Record<SemanticToken, string> {
  return themeColors(name);
}
