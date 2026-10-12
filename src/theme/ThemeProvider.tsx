import { vars } from 'nativewind';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { cssVars, themeColors, type SemanticToken, type ThemeName } from './tokens';

type ThemeValue = { name: ThemeName; colors: Record<SemanticToken, string> };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ theme, children }: { theme: ThemeName; children: ReactNode }) {
  const value = useMemo(() => ({ name: theme, colors: themeColors(theme) }), [theme]);
  const style = useMemo(() => [{ flex: 1 }, vars(cssVars(theme))], [theme]);
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
