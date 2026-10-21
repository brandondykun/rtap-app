import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { formatLength } from '@/features/location/gps-format';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { formatCoordinate } from '../interaction/readout';
import { useOpPosition } from '../op/use-op-position';
import { CardLead } from './CardLead';

type Props = {
  /** The camera is following the user (reported to screen readers; the border stays plain). */
  following: boolean;
  disabled: boolean;
  onRecenter: () => void;
};

/**
 * Bottom right, under zoom: ME and your grid, then ALT · ACC. Tapping it recenters the map on you. In OP mode it shows
 * the OP instead (its grid, then its ground elevation) and does nothing when tapped.
 */
export function SelfCard({ following, disabled, onRecenter }: Props) {
  const { colors } = useTheme();
  const fix = usePresence((s) => s.selfPosition);
  const status = usePresence((s) => s.locationStatus);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const off = status === 'denied' || status === 'unavailable';
  const op = useOpPosition();

  if (op) {
    return (
      <View testID="gps-readout" accessibilityLabel="OP position" className="rounded-2xl border border-border bg-surface-chrome px-3 py-2">
        <View testID="gps-line" className="flex-row items-center gap-2">
          <CardLead icon={<Icon name="binoculars" size={14} color={colors.accent} />} tag="OP" tagColor={colors.accent} />
          <Text testID="op-position" className="shrink font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
            {formatCoordinate(op.at, coordinateFormat)}
          </Text>
        </View>
        <Text testID="op-elevation" className="mt-0.5 font-mono text-xs text-text-muted">
          {`ELV ${formatLength(op.elevationM, unit)}`}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      testID="gps-readout"
      accessibilityRole="button"
      accessibilityLabel="Recenter on me"
      accessibilityState={{ selected: following, disabled }}
      disabled={disabled}
      onPress={onRecenter}
      className="rounded-2xl border border-border bg-surface-chrome px-3 py-2">
      <View testID="gps-line" className="flex-row items-center gap-2">
        <CardLead icon={<Icon name="navigation" size={14} color={colors.self} />} tag="ME" tagColor={colors.self} />
        {fix && !off ? (
          <Text testID="gps-position" style={{ color: colors.friendly }} className="shrink font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
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
