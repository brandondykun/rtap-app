import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { TextStyle } from 'react-native';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** The app's only icon set. Pass a theme color (`useTheme().colors.*`); `style` takes a glass outline (glassHalo). */
export function Icon({ name, size = 24, color, testID, style }: { name: IconName; size?: number; color: string; testID?: string; style?: TextStyle }) {
  return <MaterialCommunityIcons testID={testID} name={name} size={size} color={color} style={style} />;
}
