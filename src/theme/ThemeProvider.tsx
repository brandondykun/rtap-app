import { vars } from 'nativewind';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { useSettings, type PanelBackground } from '@/stores/settings';

import { cssVars, themeColors, type SemanticToken, type ThemeName } from './tokens';

/** Alpha of the see-through panels over the map for each Panel background setting. */
export const PANEL_ALPHA: Record<PanelBackground, number> = { clear: 0.15, light: 0.35, heavy: 0.6, solid: 0.9 };

type ThemeValue = { name: ThemeName; colors: Record<SemanticToken, string> };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ theme, children }: { theme: ThemeName; children: ReactNode }) {
  const glassAlpha = PANEL_ALPHA[useSettings((s) => s.panelBackground)];
  const value = useMemo(() => ({ name: theme, colors: themeColors(theme, glassAlpha) }), [theme, glassAlpha]);
  const style = useMemo(() => [{ flex: 1 }, vars(cssVars(theme, glassAlpha))], [theme, glassAlpha]);
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
