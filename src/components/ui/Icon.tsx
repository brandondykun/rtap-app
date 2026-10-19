import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** The app's only icon set. Pass a theme color (`useTheme().colors.*`). */
export function Icon({ name, size = 24, color, testID }: { name: IconName; size?: number; color: string; testID?: string }) {
  return <MaterialCommunityIcons testID={testID} name={name} size={size} color={color} />;
}
