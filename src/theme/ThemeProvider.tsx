import { vars } from 'nativewind';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { useSettings, type PanelBackground } from '@/stores/settings';

import { cssVars, themeColors, type SemanticToken, type ThemeName } from './tokens';

/**
 * Each Panel background setting: the alpha of the see-through panels over the map (`glass`), and of the white separator
 * lines on them (`divider`). They change together: a lighter panel needs a stronger line to show.
 */
export const PANEL_LOOK: Record<PanelBackground, { glass: number; divider: number }> = {
  clear: { glass: 0.15, divider: 0.45 },
  light: { glass: 0.35, divider: 0.35 },
  heavy: { glass: 0.6, divider: 0.3 },
  solid: { glass: 0.9, divider: 0.25 },
};

type ThemeValue = { name: ThemeName; colors: Record<SemanticToken, string> };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ theme, children }: { theme: ThemeName; children: ReactNode }) {
  const { glass, divider } = PANEL_LOOK[useSettings((s) => s.panelBackground)];
  const value = useMemo(() => ({ name: theme, colors: themeColors(theme, glass, divider) }), [theme, glass, divider]);
  const style = useMemo(() => [{ flex: 1 }, vars(cssVars(theme, glass, divider))], [theme, glass, divider]);
  return (
    <ThemeContext value={value}>
      <View style={style}>{children}</View>
    </ThemeContext>
  );
}

export function useTheme(): ThemeValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
