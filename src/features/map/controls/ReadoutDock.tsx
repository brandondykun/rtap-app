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
import { useReadoutOrigin } from '../interaction/use-readout-origin';
import { CardLead } from './CardLead';

/**
 * Portrait only, docked full width at the bottom: CTR (the crosshair's grid, distance over bearing from you) over ME
 * (your grid, altitude over accuracy; tap it to recenter on you). The CTR row follows `showCenter`.
 */
export function ReadoutDock({ showCenter, following, disabled, onRecenter }: { showCenter: boolean } & SelfProps) {
  return (
    <View testID="readout-dock" className="mx-2 rounded-2xl border border-border bg-surface-chrome px-3">
      {showCenter ? <CenterRow /> : null}
      {showCenter ? <View testID="dock-divider" className="h-px bg-border" /> : null}
      <SelfRow following={following} disabled={disabled} onRecenter={onRecenter} />
    </View>
  );
}

type SelfProps = {
  /** The camera is following the user (reported to screen readers; the border stays plain). */
  following: boolean;
  disabled: boolean;
  onRecenter: () => void;
};

type RowProps = { testID: string; lead: ReactNode; children: ReactNode; top?: ReactNode; bottom?: ReactNode };

/** Lead, grid, then two small lines on the right; the lead has a fixed width so both grids line up. */
function Row({ testID, lead, children, top, bottom }: RowProps) {
  return (
    <View testID={testID} className="min-h-12 flex-row items-center gap-2 py-1.5">
      <View className="w-12">{lead}</View>
      <View className="flex-1">{children}</View>
      {top || bottom ? (
        <View className="items-end">
          {top}
          {bottom}
        </View>
      ) : null}
    </View>
  );
}

function Grid({ testID, color, children }: { testID: string; color?: string; children: string }) {
  return (
    <Text testID={testID} style={color ? { color } : undefined} className="font-mono-bold text-lg text-text" adjustsFontSizeToFit numberOfLines={1}>
      {children}
    </Text>
  );
}

function SelfRow({ following, disabled, onRecenter }: SelfProps) {
  const { colors } = useTheme();
  const fix = usePresence((s) => s.selfPosition);
  const status = usePresence((s) => s.locationStatus);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const off = status === 'denied' || status === 'unavailable';
  const shown = fix && !off ? fix : null;
  return (
    <Pressable
      testID="dock-self"
      accessibilityRole="button"
      accessibilityLabel="Recenter on me"
      accessibilityState={{ selected: following, disabled }}
      disabled={disabled}
      onPress={onRecenter}>
      <Row
        testID="dock-self-row"
        lead={<CardLead icon={<Icon name="navigation" size={14} color={colors.self} />} tag="ME" tagColor={colors.self} />}
        top={
          shown ? (
            <Text testID="gps-altitude" accessibilityLabel={`Altitude ${formatLength(shown.altitudeM, unit)}`} className="font-mono text-xs text-text">
              {formatLength(shown.altitudeM, unit)}
            </Text>
          ) : null
        }
        bottom={
          shown ? (
            <Text testID="gps-accuracy" accessibilityLabel={`Accuracy ±${formatLength(shown.accuracyM, unit)}`} className="font-mono text-xs text-text-muted">
              {`±${formatLength(shown.accuracyM, unit)}`}
            </Text>
          ) : null
        }>
        {shown ? (
          <Grid testID="gps-position" color={colors.friendly}>{formatCoordinate(shown.position, coordinateFormat)}</Grid>
        ) : (
          <Text className="text-xs text-text-muted">{off ? 'Location is off' : 'Waiting for GPS…'}</Text>
        )}
      </Row>
    </Pressable>
  );
}

function CenterRow() {
  const center = useInteraction((s) => s.cameraCenter);
  const { from, isOp } = useReadoutOrigin();
  const who = isOp ? 'the OP' : 'you';
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const r = describeReadout(center, from, { coordinateFormat, angleUnit, northRef, declinationOverrideDeg }, new Date());
  return (
    <Row
      testID="dock-center"
      lead={<CardLead icon={<CrosshairGlyph size={14} />} tag="CTR" />}
      top={
        <>
          {isOp ? (
            <Text testID="readout-from-op" className="font-mono text-xs text-text-muted">
              FROM OP
            </Text>
          ) : null}
          <Text testID="readout-range" accessibilityLabel={`Distance from ${who} ${r.distance}`} className="font-mono text-xs text-accent">
            {r.distance}
          </Text>
        </>
      }
      bottom={
        <Text testID="readout-bearing" accessibilityLabel={`Bearing from ${who} ${r.bearing} ${r.ref}`} className="font-mono text-xs text-text-muted">
          {r.bearing}
        </Text>
      }>
      <Grid testID="readout-coordinate">{r.coordinate}</Grid>
    </Row>
  );
}
