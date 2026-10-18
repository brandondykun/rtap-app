import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { Icon } from '@/components/ui/Icon';
import { formatLength } from '@/features/location/gps-format';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout, formatCoordinate } from '../interaction/readout';

type Props = {
  /** The camera is following the user: outlined in amber, like an active map button. */
  following: boolean;
  disabled: boolean;
  onRecenter: () => void;
};

/**
 * Bottom left: CTR (the crosshair's grid, then range · bearing from the user; tap the bearing for grid ↔ mag) over
 * ME (your grid, then ALT · ACC; tap to recenter). The CTR line follows the Show center grid setting.
 */
export function GridCard({ following, disabled, onRecenter }: Props) {
  const showCenter = useSettings((s) => s.showCenterGrid);
  return (
    <View testID="grid-card" className={`gap-1 rounded-2xl border bg-surface-chrome px-3 py-2 ${following ? 'border-accent' : 'border-border'}`}>
      {showCenter ? <CenterLine /> : null}
      <SelfLine following={following} disabled={disabled} onRecenter={onRecenter} />
    </View>
  );
}

/** The leading icon and tag of a line, a fixed width so both grids line up. */
function Lead({ icon, tag }: { icon: ReactNode; tag: string }) {
  return (
    <View className="w-12 flex-row items-center gap-1.5">
      {icon}
      <Text className="font-mono-bold text-xs text-text-muted">{tag}</Text>
    </View>
  );
}

function CenterLine() {
  const { colors } = useTheme();
  const center = useInteraction((s) => s.cameraCenter);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const toggleGridMagnetic = useSettings((s) => s.toggleGridMagnetic);

  const r = describeReadout(center, self, { coordinateFormat, angleUnit, northRef, declinationOverrideDeg }, new Date());

  return (
    <View testID="center-line" className="flex-row items-center gap-2">
      <Lead icon={<CrosshairGlyph size={14} color={colors['text-muted']} />} tag="CTR" />
      <Text testID="readout-coordinate" className="shrink font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
        {r.coordinate}
      </Text>
      <View className="flex-row items-center">
        <Text testID="readout-range" className="font-mono text-xs text-text-muted">{`${r.distance} ·`}</Text>
        <Pressable
          testID="readout-bearing"
          accessibilityRole="button"
          accessibilityLabel={`Bearing ${r.bearing} ${r.ref}. Tap to switch grid or magnetic.`}
          hitSlop={12}
          onPress={toggleGridMagnetic}
          className="ml-1">
          <Text className="font-mono text-xs text-text-muted">{`${r.bearing} ${r.ref}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SelfLine({ following, disabled, onRecenter }: Props) {
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
      // Taller than the text, so the line is easy to hit.
      hitSlop={{ top: 4, bottom: 8, left: 12, right: 12 }}
      className="flex-row items-center gap-2">
      <Lead icon={<Icon name="navigation" size={14} color={colors.self} />} tag="ME" />
      {fix && !off ? (
        <>
          <Text testID="gps-position" className="shrink font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
            {formatCoordinate(fix.position, coordinateFormat)}
          </Text>
          <Text testID="gps-altitude" className="font-mono text-xs text-text-muted">
            {`ALT ${formatLength(fix.altitudeM, unit)} · ACC ±${formatLength(fix.accuracyM, unit)}`}
          </Text>
        </>
      ) : (
        <Text className="text-xs text-text-muted">{off ? 'Location is off' : 'Waiting for GPS…'}</Text>
      )}
    </Pressable>
  );
}
