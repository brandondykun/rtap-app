import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import type { MissionSnapshot } from '../repository';

type Props = {
  missionId: string;
  snapshot: MissionSnapshot | null;
  /** Size and shape of the box. */
  className: string;
  style?: StyleProp<ViewStyle>;
  iconSize: number;
  /** Overlays (tags), positioned absolutely by the caller. */
  children?: ReactNode;
};

/** The mission's map picture, or a dashed map placeholder before one was taken. */
export function MissionThumb({ missionId, snapshot, className, style, iconSize, children }: Props) {
  const { colors } = useTheme();
  if (!snapshot) {
    return (
      <View testID="mission-thumb-placeholder" style={style} className={`${className} items-center justify-center border border-dashed border-border bg-surface-input`}>
        <Icon name="map-outline" size={iconSize} color={colors['text-muted']} />
        {children}
      </View>
    );
  }
  return (
    <View style={style} className={`${className} overflow-hidden bg-surface-input`}>
      <Image
        testID="mission-thumb"
        // A new capture overwrites the file; the cache key changes with it.
        source={{ uri: snapshot.uri, cacheKey: `${missionId}-${snapshot.takenAt}` }}
        contentFit="cover"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityIgnoresInvertColors
      />
      {children}
    </View>
  );
}
