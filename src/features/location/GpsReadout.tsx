import { Image, Text, View } from 'react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import { formatLength } from './gps-format';

// The same marker the map draws for the user (without the heading arrow).
const SELF_ICON = require('../../../assets/map/self-no-heading.png');

/** The user's own position and altitude, shown while the GPS toolbar toggle is on. */
export function GpsReadout() {
  const fix = usePresence((s) => s.selfPosition);
  const status = usePresence((s) => s.locationStatus);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const off = status === 'denied' || status === 'unavailable';

  return (
    <View testID="gps-readout" className="self-start rounded-2xl border border-border bg-surface-chrome px-3 py-2">
      <View className="flex-row items-center gap-2">
        <Image source={SELF_ICON} style={{ width: 20, height: 20 }} accessibilityIgnoresInvertColors />
        {fix && !off ? (
          <Text testID="gps-position" className="font-mono-bold text-base text-text">
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
