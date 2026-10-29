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
 * CTR (the crosshair's grid, distance and bearing from you) over ME (your grid, altitude and accuracy; tap it to recenter
 * on you). The CTR row follows `showCenter`; `showSelf` false leaves only CTR (landscape, over an action bar). In OP mode
 * the ME row shows the OP instead (its grid and ground elevation) and does nothing when tapped.
 * - portrait: docked full width at the bottom, each row's details stacked on the right;
 * - `inline` (landscape): bottom right, as wide as its content, each row's details on one line after its grid.
 */
export function ReadoutDock({
  showCenter,
  showSelf = true,
  inline = false,
  maxWidth,
  following,
  disabled,
  onRecenter,
  onSetLocation,
}: { showCenter: boolean; showSelf?: boolean; inline?: boolean; maxWidth?: number } & SelfProps) {
  // See-through, so it hides less of the map; its text is outlined to read over bright ground.
  return (
    <View testID="readout-dock" style={maxWidth === undefined ? undefined : { maxWidth }} className={inline ? 'rounded-xl bg-surface-glass px-2' : 'mx-2 rounded-2xl bg-surface-glass px-3'}>
      {showCenter ? <CenterRow inline={inline} /> : null}
      {showCenter && showSelf ? <View testID="dock-divider" className="h-px bg-divider" /> : null}
      {showSelf ? <SelfRow inline={inline} following={following} disabled={disabled} onRecenter={onRecenter} onSetLocation={onSetLocation} /> : null}
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

type RowProps = { testID: string; inline: boolean; lead: ReactNode; children: ReactNode; top?: ReactNode; bottom?: ReactNode };

/**
 * Lead, grid, then the details on the right: two small lines, or one line when `inline`. The lead has a fixed width so
 * both grids line up; inline, the grid grows to the widest row so the details line up too, and everything is tighter
 * to take as little of the map as it can.
 */
function Row({ testID, inline, lead, children, top, bottom }: RowProps) {
  return (
    <View testID={testID} className={inline ? 'flex-row items-center gap-1.5 py-1' : 'min-h-12 flex-row items-center gap-2 py-1.5'}>
      <View className={inline ? 'w-10' : 'w-12'}>{lead}</View>
      <View className={inline ? 'shrink grow' : 'flex-1'}>{children}</View>
      {top || bottom ? (
        <View testID={`${testID}-details`} className={inline ? 'ml-1 flex-row items-center gap-1.5' : 'items-end'}>
          {top}
          {bottom}
        </View>
      ) : null}
    </View>
  );
}

/** `outline` adds a crisp dark edge to the soft one, so the grid reads over snow (CTR and yours). `small` for the inline dock. */
function Grid({ testID, color, outline = false, small = false, children }: { testID: string; color?: string; outline?: boolean; small?: boolean; children: string }) {
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  const size = small ? 'text-base' : 'text-lg';
  return outline ? (
    <OutlinedText testID={testID} color={color ?? colors.text} style={halo} className={`font-mono-bold ${size} text-text`} adjustsFontSizeToFit numberOfLines={1}>
      {children}
    </OutlinedText>
  ) : (
    <Text testID={testID} style={[halo, color ? { color } : undefined]} className={`font-mono-bold ${size} text-text`} adjustsFontSizeToFit numberOfLines={1}>
      {children}
    </Text>
  );
}

function SelfRow(props: SelfProps & { inline: boolean }) {
  const op = useOpPosition();
  return op ? <OpRow inline={props.inline} at={op.at} elevationM={op.elevationM} /> : <MeRow {...props} />;
}

function OpRow({ inline, at, elevationM }: { inline: boolean; at: LatLon; elevationM: number | null }) {
  const { colors } = useTheme();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  return (
    <View testID="dock-self" accessibilityLabel="OP position">
      <Row
        testID="dock-self-row"
        inline={inline}
        lead={<CardLead icon={<Icon name="binoculars" size={inline ? 12 : 14} color={colors.accent} outline />} tag="OP" tagColor={colors.accent} tagStyle={glassHalo(colors)} outline />}
        top={
          <OutlinedText testID="op-elevation" accessibilityLabel={`Ground elevation ${formatLength(elevationM, unit)}`} color={colors.text} style={glassHalo(colors)} className="font-mono text-xs">
            {`ELV ${formatLength(elevationM, unit)}`}
          </OutlinedText>
        }>
        <Grid testID="op-position" outline small={inline}>
          {formatCoordinate(at, coordinateFormat)}
        </Grid>
      </Row>
    </View>
  );
}

function MeRow({ inline, following, disabled, onRecenter, onSetLocation }: SelfProps & { inline: boolean }) {
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
        inline={inline}
        lead={<CardLead icon={<Icon testID="me-icon" name="navigation" size={inline ? 12 : 14} color={colors.friendly} outline />} tag="ME" tagColor={colors.friendly} tagStyle={halo} outline />}
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
          <Grid testID="gps-position" color={colors.friendly} outline small={inline}>{formatCoordinate(shown.position, coordinateFormat)}</Grid>
        ) : (
          <OutlinedText color={colors.friendly} style={halo} className="text-xs">
            {me.kind === 'set' ? SET_LOCATION_MESSAGE[me.reason] : 'Waiting for GPS…'}
          </OutlinedText>
        )}
      </Row>
    </Pressable>
  );
}

function CenterRow({ inline }: { inline: boolean }) {
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
      inline={inline}
      lead={<CardLead icon={<CrosshairGlyph size={inline ? 12 : 14} outline />} tag="CTR" tagColor={colors.text} tagStyle={halo} outline />}
      top={
        <>
          {isOp ? (
            <OutlinedText testID="readout-from-op" color={colors.text} style={halo} className="font-mono text-xs">
              FROM OP
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
      <Grid testID="readout-coordinate" outline small={inline}>
        {r.coordinate}
      </Grid>
    </Row>
  );
}
