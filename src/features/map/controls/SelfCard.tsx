import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { OutlinedText } from '@/components/ui/OutlinedText';
import { formatLength } from '@/features/location/gps-format';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { formatCoordinate } from '../interaction/readout';
import { useOpPosition } from '../op/use-op-position';
import { CardLead } from './CardLead';
import { SET_LOCATION_MESSAGE, useMeState } from './use-me-state';
import { glassHalo } from '@/components/ui/glass';

type Props = {
  /** The camera is following the user (reported to screen readers; the border stays plain). */
  following: boolean;
  disabled: boolean;
  onRecenter: () => void;
  /** Opens setting the location by hand (offered while location is off or Manual has no position). */
  onSetLocation: () => void;
};

/**
 * Bottom right, under zoom: ME and your grid, then ALT · ACC. Tapping it recenters the map on you. In OP mode it shows
 * the OP instead (its grid, then its ground elevation) and does nothing when tapped.
 */
export function SelfCard({ following, disabled, onRecenter, onSetLocation }: Props) {
  const { colors } = useTheme();
  const me = useMeState();
  const fix = me.kind === 'fix' ? me.fix : null;
  const setting = me.kind === 'set';
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const op = useOpPosition();

  // See-through like the CTR card, so it hides less of the map; the text is outlined to read over bright ground.
  const halo = glassHalo(colors);

  if (op) {
    return (
      <View testID="gps-readout" accessibilityLabel="OP position" className="rounded-2xl bg-surface-glass px-3 py-2">
        <View testID="gps-line" className="flex-row items-center gap-2">
          <CardLead icon={<Icon name="binoculars" size={14} color={colors.accent} outline />} tag="OP" tagColor={colors.accent} tagStyle={halo} outline />
          <View className="shrink">
            <OutlinedText testID="op-position" color={colors.text} style={halo} className="font-mono-bold text-sm" adjustsFontSizeToFit numberOfLines={1}>
              {formatCoordinate(op.at, coordinateFormat)}
            </OutlinedText>
          </View>
        </View>
        <View className="mt-0.5">
          <OutlinedText testID="op-elevation" color={colors.text} style={halo} className="font-mono text-xs">
            {`ELV ${formatLength(op.elevationM, unit)}`}
          </OutlinedText>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      testID="gps-readout"
      accessibilityRole="button"
      accessibilityLabel={setting ? 'Set your location' : 'Recenter on me'}
      accessibilityState={setting ? undefined : { selected: following, disabled }}
      // With nothing to recenter on, a tap sets the location by hand instead.
      disabled={setting ? false : disabled}
      onPress={setting ? onSetLocation : onRecenter}
      className="active:opacity-60 rounded-2xl bg-surface-glass px-3 py-2">
      <View testID="gps-line" className="flex-row items-center gap-2">
        <CardLead icon={<Icon testID="me-icon" name="navigation" size={14} color={colors.friendly} outline />} tag="ME" tagColor={colors.friendly} tagStyle={halo} outline />
        {fix ? (
          <View className="shrink">
            <OutlinedText testID="gps-position" color={colors.friendly} style={halo} className="font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
              {formatCoordinate(fix.position, coordinateFormat)}
            </OutlinedText>
          </View>
        ) : (
          <OutlinedText color={colors.friendly} style={halo} className="text-xs">
            {me.kind === 'set' ? SET_LOCATION_MESSAGE[me.reason] : 'Waiting for GPS…'}
          </OutlinedText>
        )}
      </View>
      {fix?.manual ? (
        <View className="mt-0.5">
          <OutlinedText testID="gps-manual" color={colors.friendly} style={halo} className="font-mono text-xs">
            MANUAL
          </OutlinedText>
        </View>
      ) : fix ? (
        <View className="mt-0.5">
          <OutlinedText testID="gps-altitude" color={colors.friendly} style={halo} className="font-mono text-xs">
            {`ALT ${formatLength(fix.altitudeM, unit)} · ACC ±${formatLength(fix.accuracyM, unit)}`}
          </OutlinedText>
        </View>
      ) : setting ? (
        <View className="mt-0.5">
          <OutlinedText testID="set-location-hint" color={colors.friendly} style={halo} className="text-xs">
            Tap to set your location
          </OutlinedText>
        </View>
      ) : null}
    </Pressable>
  );
}
