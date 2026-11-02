import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import type { MissionSnapshot } from '../repository';
import { snapshotFile } from '../snapshot-files';

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

/** The mission's map picture, or a dashed map placeholder before one was taken or when it fails to load. */
export function MissionThumb({ missionId, snapshot, className, style, iconSize, children }: Props) {
  const { colors } = useTheme();
  // Each capture is a new file (named by when it was taken), so a newer picture always loads; a failure retries then.
  const [failedAt, setFailedAt] = useState<number | null>(null);
  if (!snapshot || failedAt === snapshot.takenAt) {
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
        // Built from the mission id, not the stored uri: the iOS container path can change across
        // app updates and reinstalls, so a stored absolute path goes stale.
        source={{ uri: snapshotFile(missionId, snapshot.takenAt).uri }}
        onError={() => setFailedAt(snapshot.takenAt)}
        contentFit="cover"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityIgnoresInvertColors
      />
      {children}
    </View>
  );
}
