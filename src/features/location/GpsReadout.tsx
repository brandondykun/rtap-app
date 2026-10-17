import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { formatLength } from './gps-format';

type Props = {
  /** The camera is following the user: outlined in amber, like an active map button. */
  following: boolean;
  disabled: boolean;
  onPress: () => void;
};

/** The user's own position and altitude, bottom left; tapping it recenters the map on the user. */
export function GpsReadout({ following, disabled, onPress }: Props) {
  const fix = usePresence((s) => s.selfPosition);
  const status = usePresence((s) => s.locationStatus);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const { colors } = useTheme();
  const off = status === 'denied' || status === 'unavailable';

  return (
    <Pressable
      testID="gps-readout"
      accessibilityRole="button"
      accessibilityLabel="Recenter on me"
      accessibilityState={{ selected: following, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`rounded-2xl border bg-surface-chrome px-3 py-2 ${following ? 'border-accent' : 'border-border'}`}>
      <View className="flex-row items-center gap-2">
        <Icon name="navigation" size={16} color={colors.self} />
        {fix && !off ? (
          <Text testID="gps-position" className="font-mono-bold text-base text-text">
            {formatCoordinate(fix.position, coordinateFormat)}
          </Text>
        ) : (
          <Text className="text-xs text-text-muted">{off ? 'Location is off' : 'Waiting for GPS…'}</Text>
        )}
      </View>
      {fix && !off ? (
        <Text testID="gps-altitude" className="mt-0.5 font-mono text-xs text-text-muted">
          {`ALT ${formatLength(fix.altitudeM, unit)} · ACC ±${formatLength(fix.accuracyM, unit)}`}
        </Text>
      ) : null}
    </Pressable>
  );
}
