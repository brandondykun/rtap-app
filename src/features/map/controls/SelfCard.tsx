import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { formatLength } from '@/features/location/gps-format';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { formatCoordinate } from '../interaction/readout';
import { CardLead } from './CardLead';

type Props = {
  /** The camera is following the user: outlined in amber, like an active map button. */
  following: boolean;
  disabled: boolean;
  onRecenter: () => void;
};

/** Bottom right, under zoom: ME and your grid, then ALT · ACC. Tapping it recenters the map on you. */
export function SelfCard({ following, disabled, onRecenter }: Props) {
  const { colors } = useTheme();
  const fix = usePresence((s) => s.selfPosition);
  const status = usePresence((s) => s.locationStatus);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const off = status === 'denied' || status === 'unavailable';

  return (
    <Pressable
      testID="gps-readout"
      accessibilityRole="button"
      accessibilityLabel="Recenter on me"
      accessibilityState={{ selected: following, disabled }}
      disabled={disabled}
      onPress={onRecenter}
      className={`rounded-2xl border bg-surface-chrome px-3 py-2 ${following ? 'border-accent' : 'border-border'}`}>
      <View testID="gps-line" className="flex-row items-center gap-2">
        <CardLead icon={<Icon name="navigation" size={14} color={colors.self} />} tag="ME" />
        {fix && !off ? (
          <Text testID="gps-position" className="shrink font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
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
