import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { View, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { OUTLINE_HIDDEN, outlineShifts } from './outline';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color: string;
  testID?: string;
  style?: TextStyle;
  /** A crisp dark edge one device pixel wide, so the icon reads over snow (like OutlinedText). */
  outline?: boolean;
};

/** The app's only icon set. Pass a theme color (`useTheme().colors.*`); `style` takes a glass outline (glassHalo). */
export function Icon({ name, size = 24, color, testID, style, outline = false }: Props) {
  const { colors } = useTheme();
  const glyph = <MaterialCommunityIcons testID={testID} name={name} size={size} color={color} style={style} />;
  if (!outline) return glyph;
  return (
    <View>
      {outlineShifts().map(([x, y]) => (
        <MaterialCommunityIcons
          key={`${x},${y}`}
          testID="icon-outline"
          {...OUTLINE_HIDDEN}
          name={name}
          size={size}
          color={colors['point-symbol-halo']}
          style={[style, { position: 'absolute', left: 0, top: 0, transform: [{ translateX: x }, { translateY: y }] }]}
        />
      ))}
      {glyph}
    </View>
  );
}
