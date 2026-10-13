/**
 * Single source of truth for color. Palette entries are Tailwind CSS v3 colors, copied by
 * hand; only this folder may reference them. Everything else uses semantic tokens.
 */
export const palette = {
  'stone-50': '#fafaf9',
  'stone-400': '#a8a29e',
  'stone-700': '#44403c',
  'stone-800': '#292524',
  'stone-900': '#1c1917',
  'neutral-950': '#0a0a0a',
  'amber-500': '#f59e0b',
  'amber-950': '#451a03',
  'green-300': '#86efac',
  'green-500': '#22c55e',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'blue-400': '#60a5fa',
  'sky-300': '#7dd3fc',
  'sky-400': '#38bdf8',
  'yellow-300': '#fde047',
} as const;

export type PaletteName = keyof typeof palette;
type TokenValue = PaletteName | { color: PaletteName; alpha: number };

const dark = {
  surface: 'stone-900',
  'surface-chrome': { color: 'neutral-950', alpha: 0.9 },
  'surface-input': 'neutral-950',
  'surface-raised': 'stone-800',
  border: 'stone-700',
  text: 'stone-50',
  'text-muted': 'stone-400',
  accent: 'amber-500',
  'accent-subtle': 'amber-950',
  'on-accent': 'neutral-950',
  success: 'green-500',
  danger: 'red-500',
  friendly: 'sky-300',
  hostile: 'red-400',
  neutral: 'green-300',
  unknown: 'yellow-300',
  self: 'sky-400',
  'map-label-bg': { color: 'neutral-950', alpha: 0.85 },
  'map-label-text': 'stone-50',
  /** Control-measure point symbols (build-time only): blue lines with a dark halo. */
  'point-symbol': 'blue-400',
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

export function themeColors(name: ThemeName): Record<SemanticToken, string> {
  const theme: Record<SemanticToken, TokenValue> = themes[name];
  return Object.fromEntries(
    Object.entries(theme).map(([token, value]) => [token, resolve(value)]),
  ) as Record<SemanticToken, string>;
}

export function cssVars(name: ThemeName): Record<string, string> {
  return Object.fromEntries(Object.entries(themeColors(name)).map(([token, color]) => [`--${token}`, color]));
}

/** Raw colors for Mapbox layer styles and build scripts; identical to the UI colors. */
export function mapColors(name: ThemeName): Record<SemanticToken, string> {
  return themeColors(name);
}
