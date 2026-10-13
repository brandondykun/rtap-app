import { Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { formatLength } from './gps-format';

/** The user's own position and altitude, shown while the GPS toolbar toggle is on. */
export function GpsReadout() {
  const fix = usePresence((s) => s.selfPosition);
  const status = usePresence((s) => s.locationStatus);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const { colors } = useTheme();
  const off = status === 'denied' || status === 'unavailable';

  return (
    <View testID="gps-readout" className="self-start rounded-2xl border border-border bg-surface-chrome px-3 py-2">
      <View className="flex-row items-center gap-2">
        <Icon name="navigation" size={20} color={colors.self} />
        {fix && !off ? (
          <Text testID="gps-position" className="font-mono-bold text-lg text-text">
            {formatCoordinate(fix.position, coordinateFormat)}
          </Text>
        ) : (
          <Text className="text-sm text-text-muted">{off ? 'Location is off' : 'Waiting for GPS…'}</Text>
        )}
      </View>
      {fix && !off ? (
        <Text testID="gps-altitude" className="mt-0.5 font-mono text-sm text-text-muted">
          {`ALT ${formatLength(fix.altitudeM, unit)} · ACC ±${formatLength(fix.accuracyM, unit)}`}
        </Text>
      ) : null}
    </View>
  );
}
