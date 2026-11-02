import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { Icon } from '@/components/ui/Icon';
import { OutlinedText } from '@/components/ui/OutlinedText';
import { formatLength } from '@/features/location/gps-format';
import type { AngleUnit, LatLon } from '@/lib/geo/types';
import { useInteraction } from '@/stores/interaction';
import { type AltitudeUnit, useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout, formatCoordinate } from '../interaction/readout';
import { useReadoutOrigin } from '../interaction/use-readout-origin';
import { useOpPosition } from '../op/use-op-position';
import { CardLead } from './CardLead';
import { SET_LOCATION_MESSAGE, useMeState } from './use-me-state';
import { glassHalo } from '@/components/ui/glass';

/**
 * CTR (the crosshair's grid, distance and bearing from you) over ME (your grid, altitude and accuracy; tap it to recenter
 * on you). The CTR row follows `showCenter`. In OP mode the ME row shows the OP instead (its grid and ground elevation)
 * and does nothing when tapped.
 * - portrait: docked full width at the bottom, each row's details stacked on the right;
 * - `inline` (landscape): bottom right, as wide as its content, each row's details on one line after its grid;
 *   `minimal` drops the details, leaving only each row's lead and grid.
 */
export function ReadoutDock({
  showCenter,
  inline = false,
  minimal = false,
  maxWidth,
  following,
  disabled,
  onRecenter,
  onSetLocation,
}: { showCenter: boolean; inline?: boolean; minimal?: boolean; maxWidth?: number } & SelfProps) {
  // See-through, so it hides less of the map; its text is outlined to read over bright ground.
  return (
    <View testID="readout-dock" style={maxWidth === undefined ? undefined : { maxWidth }} className={inline ? 'rounded-xl bg-surface-glass px-2' : 'mx-2 rounded-2xl bg-surface-glass px-3'}>
      {showCenter ? <CenterRow inline={inline} minimal={minimal} /> : null}
      {showCenter ? <View testID="dock-divider" className="h-px bg-divider" /> : null}
      <SelfRow inline={inline} minimal={minimal} following={following} disabled={disabled} onRecenter={onRecenter} onSetLocation={onSetLocation} />
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

type RowProps = { testID: string; inline: boolean; minimal?: boolean; lead: ReactNode; children: ReactNode; top?: ReactNode; bottom?: ReactNode };

/**
 * Lead, grid, then the details on the right: two small lines, or one line when `inline`. The lead has a fixed width so
 * both grids line up; inline, the grid grows to the widest row so the details line up too, and everything is tighter
 * to take as little of the map as it can.
 */
function Row({ testID, inline, minimal = false, lead, children, top, bottom }: RowProps) {
  return (
    <View testID={testID} className={inline ? 'flex-row items-center gap-1.5 py-1' : 'min-h-12 flex-row items-center gap-2 py-1.5'}>
      <View className={inline ? 'w-10' : 'w-12'}>{lead}</View>
      <View className={inline ? 'shrink grow' : 'flex-1'}>{children}</View>
      {!minimal && (top || bottom) ? (
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

/**
 * Inline, the card is as wide as its content, so a value that gets longer (987 m → 1.24 km) would widen it. The details
 * are monospaced: an invisible `template` as long as the longest value the detail shows keeps its width fixed.
 */
function Reserve({ inline, template, children }: { inline: boolean; template: string; children: ReactNode }) {
  if (!inline) return children;
  return (
    <View className="items-end">
      {children}
      <Text testID="detail-reserve" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 0 }} className="font-mono text-xs opacity-0">
        {template}
      </Text>
    </View>
  );
}

/** The longest distance the CTR row shows, short of the other side of the world. */
const DISTANCE_TEMPLATE = '0000 km';
const BEARING_TEMPLATE: Record<AngleUnit, string> = { deg: '000°', mil: '0000 mils' };
/** The longest altitude and accuracy (to 9,999 m / 99,999 ft). */
const ALTITUDE_TEMPLATE: Record<AltitudeUnit, string> = { m: '0000 m', ft: '00000 ft' };
const ACCURACY_TEMPLATE: Record<AltitudeUnit, string> = { m: '±0000 m', ft: '±00000 ft' };

/** A typical full-length grid, held invisibly while there is no fix so the row is as tall (and, inline, as wide) as with one. */
const GRID_TEMPLATE_AT: LatLon = { lat: -38.88888, lon: -177.88888 };

/** Takes up its children's space without showing them or reaching screen readers. */
function Placeholder({ children }: { children: ReactNode }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="opacity-0">
      {children}
    </View>
  );
}

function SelfRow(props: SelfProps & { inline: boolean; minimal: boolean }) {
  const op = useOpPosition();
  return op ? <OpRow inline={props.inline} minimal={props.minimal} at={op.at} elevationM={op.elevationM} /> : <MeRow {...props} />;
}

function OpRow({ inline, minimal, at, elevationM }: { inline: boolean; minimal: boolean; at: LatLon; elevationM: number | null }) {
  const { colors } = useTheme();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  return (
    <View testID="dock-self" accessibilityLabel="OP position">
      <Row
        testID="dock-self-row"
        inline={inline}
        minimal={minimal}
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

function MeRow({ inline, minimal, following, disabled, onRecenter, onSetLocation }: SelfProps & { inline: boolean; minimal: boolean }) {
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  const me = useMeState();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const unit = useSettings((s) => s.altitudeUnit);
  const shown = me.kind === 'fix' ? me.fix : null;
  const setting = me.kind === 'set';
  // Without a fix, invisible stand-ins hold the space the grid and its details will take, so the card does not grow when GPS arrives.
  const detailPlaceholder = (template: string) => (
    <Placeholder>
      <OutlinedText color={colors.friendly} style={halo} className="font-mono text-xs">
        {template}
      </OutlinedText>
    </Placeholder>
  );
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
        minimal={minimal}
        lead={<CardLead icon={<Icon testID="me-icon" name="navigation" size={inline ? 12 : 14} color={colors.friendly} outline />} tag="ME" tagColor={colors.friendly} tagStyle={halo} outline />}
        top={
          shown && !shown.manual ? (
            <Reserve inline={inline} template={ALTITUDE_TEMPLATE[unit]}>
              <OutlinedText testID="gps-altitude" accessibilityLabel={`Altitude ${formatLength(shown.altitudeM, unit)}`} color={colors.friendly} style={halo} className="font-mono text-xs">
                {formatLength(shown.altitudeM, unit)}
              </OutlinedText>
            </Reserve>
          ) : shown ? null : (
            detailPlaceholder(ALTITUDE_TEMPLATE[unit])
          )
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
            <Reserve inline={inline} template={ACCURACY_TEMPLATE[unit]}>
              <OutlinedText testID="gps-accuracy" accessibilityLabel={`Accuracy ±${formatLength(shown.accuracyM, unit)}`} color={colors.friendly} style={halo} className="font-mono text-xs">
                {`±${formatLength(shown.accuracyM, unit)}`}
              </OutlinedText>
            </Reserve>
          ) : (
            detailPlaceholder(ACCURACY_TEMPLATE[unit])
          )
        }>
        {shown ? (
          <Grid testID="gps-position" color={colors.friendly} outline small={inline}>{formatCoordinate(shown.position, coordinateFormat)}</Grid>
        ) : (
          <View>
            <Placeholder>
              <Grid testID="gps-position-placeholder" outline small={inline}>
                {formatCoordinate(GRID_TEMPLATE_AT, coordinateFormat)}
              </Grid>
            </Placeholder>
            <View className="absolute inset-0 justify-center">
              <OutlinedText color={colors.friendly} style={halo} className="text-xs" numberOfLines={1}>
                {me.kind === 'set' ? SET_LOCATION_MESSAGE[me.reason] : 'Waiting for GPS…'}
              </OutlinedText>
            </View>
          </View>
        )}
      </Row>
    </Pressable>
  );
}

function CenterRow({ inline, minimal }: { inline: boolean; minimal: boolean }) {
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
      minimal={minimal}
      lead={<CardLead icon={<CrosshairGlyph size={inline ? 12 : 14} outline />} tag="CTR" tagColor={colors.text} tagStyle={halo} outline />}
      top={
        <>
          {isOp ? (
            <OutlinedText testID="readout-from-op" color={colors.text} style={halo} className="font-mono text-xs">
              FROM OP
            </OutlinedText>
          ) : null}
          <Reserve inline={inline} template={DISTANCE_TEMPLATE}>
            <OutlinedText testID="readout-range" accessibilityLabel={`Distance from ${who} ${r.distance}`} color={colors.accent} style={halo} className="font-mono text-xs">
              {r.distance}
            </OutlinedText>
          </Reserve>
        </>
      }
      bottom={
        <Reserve inline={inline} template={BEARING_TEMPLATE[angleUnit]}>
          <OutlinedText testID="readout-bearing" accessibilityLabel={`Bearing from ${who} ${r.bearing} ${r.ref}`} color={colors.text} style={halo} className="font-mono text-xs">
            {r.bearing}
          </OutlinedText>
        </Reserve>
      }>
      <Grid testID="readout-coordinate" outline small={inline}>
        {r.coordinate}
      </Grid>
    </Row>
  );
}
