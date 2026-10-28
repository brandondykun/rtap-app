import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { Icon } from '@/components/ui/Icon';
import { OutlinedText } from '@/components/ui/OutlinedText';
import { formatLength } from '@/features/location/gps-format';
import type { LatLon } from '@/lib/geo/types';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout, formatCoordinate } from '../interaction/readout';
import { useReadoutOrigin } from '../interaction/use-readout-origin';
import { useOpPosition } from '../op/use-op-position';
import { CardLead } from './CardLead';
import { SET_LOCATION_MESSAGE, useMeState } from './use-me-state';
import { glassHalo } from '@/components/ui/glass';

/**
 * Portrait only, docked full width at the bottom: CTR (the crosshair's grid, distance over bearing from you) over ME
 * (your grid, altitude over accuracy; tap it to recenter on you). The CTR row follows `showCenter`. In OP mode the
 * ME row shows the OP instead (its grid and ground elevation) and does nothing when tapped.
 */
export function ReadoutDock({ showCenter, following, disabled, onRecenter, onSetLocation }: { showCenter: boolean } & SelfProps) {
  // See-through, so it hides less of the map; its text is outlined to read over bright ground.
  return (
    <View testID="readout-dock" className="mx-2 rounded-2xl bg-surface-glass px-3">
      {showCenter ? <CenterRow /> : null}
      {showCenter ? <View testID="dock-divider" className="h-px bg-divider" /> : null}
      <SelfRow following={following} disabled={disabled} onRecenter={onRecenter} onSetLocation={onSetLocation} />
    </View>
  );
}

type SelfProps = {
  /** The camera is following the user (reported to screen readers; the border stays plain). */
  following: boolean;
  disabled: boolean;
  onRecenter: () => void;
  /** Opens setting the location by hand (offered while location is off or Manual has no position). */
  onSetLocation: () => void;
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

/** `outline` adds a crisp dark edge to the soft one, so the grid reads over snow (CTR and yours). */
function Grid({ testID, color, outline = false, children }: { testID: string; color?: string; outline?: boolean; children: string }) {
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  return outline ? (
    <OutlinedText testID={testID} color={color ?? colors.text} style={halo} className="font-mono-bold text-lg text-text" adjustsFontSizeToFit numberOfLines={1}>
      {children}
    </OutlinedText>
  ) : (
    <Text testID={testID} style={[halo, color ? { color } : undefined]} className="font-mono-bold text-lg text-text" adjustsFontSizeToFit numberOfLines={1}>
      {children}
    </Text>
  );
}

function SelfRow(props: SelfProps) {
  const op = useOpPosition();
  return op ? <OpRow at={op.at} elevationM={op.elevationM} /> : <MeRow {...props} />;
}

function OpRow({ at, elevationM }: { at: LatLon; elevationM: number | null }) {
  const { colors } = useTheme();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  return (
    <View testID="dock-self" accessibilityLabel="OP position">
      <Row
        testID="dock-self-row"
        lead={<CardLead icon={<Icon name="binoculars" size={14} color={colors.accent} outline />} tag="OP" tagColor={colors.accent} tagStyle={glassHalo(colors)} outline />}
        top={
          <OutlinedText testID="op-elevation" accessibilityLabel={`Ground elevation ${formatLength(elevationM, unit)}`} color={colors.text} style={glassHalo(colors)} className="font-mono text-xs">
            {`ELV ${formatLength(elevationM, unit)}`}
          </OutlinedText>
        }>
        <Grid testID="op-position" outline>
          {formatCoordinate(at, coordinateFormat)}
        </Grid>
      </Row>
    </View>
  );
}

function MeRow({ following, disabled, onRecenter, onSetLocation }: SelfProps) {
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  const me = useMeState();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const shown = me.kind === 'fix' ? me.fix : null;
  const setting = me.kind === 'set';
  return (
    <Pressable
      testID="dock-self"
      accessibilityRole="button"
      accessibilityLabel={setting ? 'Set your location' : 'Recenter on me'}
      accessibilityState={setting ? undefined : { selected: following, disabled }}
      // With nothing to recenter on, a tap sets the location by hand instead.
      disabled={setting ? false : disabled}
      onPress={setting ? onSetLocation : onRecenter}
      className="active:opacity-60">
      <Row
        testID="dock-self-row"
        lead={<CardLead icon={<Icon testID="me-icon" name="navigation" size={14} color={colors.friendly} outline />} tag="ME" tagColor={colors.friendly} tagStyle={halo} outline />}
        top={
          shown && !shown.manual ? (
            <OutlinedText testID="gps-altitude" accessibilityLabel={`Altitude ${formatLength(shown.altitudeM, unit)}`} color={colors.friendly} style={halo} className="font-mono text-xs">
              {formatLength(shown.altitudeM, unit)}
            </OutlinedText>
          ) : null
        }
        bottom={
          shown?.manual ? (
            <OutlinedText testID="gps-manual" color={colors.friendly} style={halo} className="font-mono text-xs">
              MANUAL
            </OutlinedText>
          ) : setting ? (
            <OutlinedText testID="set-location-hint" color={colors.friendly} style={halo} className="text-xs">
              Tap to set your location
            </OutlinedText>
          ) : shown ? (
            <OutlinedText testID="gps-accuracy" accessibilityLabel={`Accuracy ±${formatLength(shown.accuracyM, unit)}`} color={colors.friendly} style={halo} className="font-mono text-xs">
              {`±${formatLength(shown.accuracyM, unit)}`}
            </OutlinedText>
          ) : null
        }>
        {shown ? (
          <Grid testID="gps-position" color={colors.friendly} outline>{formatCoordinate(shown.position, coordinateFormat)}</Grid>
        ) : (
          <OutlinedText color={colors.friendly} style={halo} className="text-xs">
            {me.kind === 'set' ? SET_LOCATION_MESSAGE[me.reason] : 'Waiting for GPS…'}
          </OutlinedText>
        )}
      </Row>
    </Pressable>
  );
}

function CenterRow() {
  const center = useInteraction((s) => s.cameraCenter);
  const { from, isOp, isManual } = useReadoutOrigin();
  const who = isOp ? 'the OP' : isManual ? 'you (manual position)' : 'you';
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const r = describeReadout(center, from, { coordinateFormat, angleUnit, northRef, declinationOverrideDeg }, new Date());
  const { colors } = useTheme();
  // The small text is full white with a crisp dark edge, so it reads over bright ground.
  const halo = glassHalo(colors);
  return (
    <Row
      testID="dock-center"
      lead={<CardLead icon={<CrosshairGlyph size={14} outline />} tag="CTR" tagColor={colors.text} tagStyle={halo} outline />}
      top={
        <>
          {isOp ? (
            <OutlinedText testID="readout-from-op" color={colors.text} style={halo} className="font-mono text-xs">
              FROM OP
            </OutlinedText>
          ) : isManual ? (
            <OutlinedText testID="readout-from-manual" color={colors.text} style={halo} className="font-mono text-xs">
              FROM ME (MAN)
            </OutlinedText>
          ) : null}
          <OutlinedText testID="readout-range" accessibilityLabel={`Distance from ${who} ${r.distance}`} color={colors.accent} style={halo} className="font-mono text-xs">
            {r.distance}
          </OutlinedText>
        </>
      }
      bottom={
        <OutlinedText testID="readout-bearing" accessibilityLabel={`Bearing from ${who} ${r.bearing} ${r.ref}`} color={colors.text} style={halo} className="font-mono text-xs">
          {r.bearing}
        </OutlinedText>
      }>
      <Grid testID="readout-coordinate" outline>
        {r.coordinate}
      </Grid>
    </Row>
  );
}
