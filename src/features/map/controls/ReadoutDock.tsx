import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { Icon } from '@/components/ui/Icon';
import { OutlinedText } from '@/components/ui/OutlinedText';
import { tightUnit } from '@/components/ui/unit-gap';
import { AverageActions, AverageHeader } from '@/features/location/AverageStatus';
import { formatLength } from '@/features/location/gps-format';
import type { AngleUnit, LatLon } from '@/lib/geo/types';
import { useGpsAverage } from '@/stores/gps-average';
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
 * In Average mode an orange border and a status line frame it, and while paused its Resume/Stop buttons sit below.
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
  const averageOn = useGpsAverage((s) => s.phase !== 'off');
  // See-through, so it hides less of the map; its text is outlined to read over bright ground.
  const shape = inline ? 'rounded-xl bg-surface-glass px-2' : 'mx-2 rounded-2xl bg-surface-glass px-3';
  return (
    <View testID="readout-dock" style={maxWidth === undefined ? undefined : { maxWidth }} className={averageOn ? `${shape} overflow-hidden border-2 border-averaged` : shape}>
      {averageOn ? <AverageHeader inline={inline} minimal={minimal} /> : null}
      {showCenter ? <CenterRow inline={inline} minimal={minimal} /> : null}
      {showCenter ? <View testID="dock-divider" className="h-px bg-divider" /> : null}
      <SelfRow inline={inline} minimal={minimal} following={following} disabled={disabled} onRecenter={onRecenter} onSetLocation={onSetLocation} />
      {averageOn ? <AverageActions inline={inline} /> : null}
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

type RowProps = {
  testID: string;
  inline: boolean;
  minimal?: boolean;
  lead: ReactNode;
  children: ReactNode;
  top?: ReactNode;
  bottom?: ReactNode;
  /** Inline: a tighter gap between the two details (ME, whose labelled altitude is the longer). */
  tight?: boolean;
};

/**
 * Lead, grid, then the details on the right: two small lines, or one line when `inline`. The lead has a fixed width so
 * both grids line up; inline, the grid grows to the widest row so the details line up too, and everything is tighter
 * to take as little of the map as it can.
 */
function Row({ testID, inline, minimal = false, lead, children, top, bottom, tight = false }: RowProps) {
  return (
    <View testID={testID} className={inline ? 'flex-row items-center gap-1.5 py-1' : 'min-h-12 flex-row items-center gap-2 py-1.5'}>
      <View className={inline ? 'w-10' : 'w-12'}>{lead}</View>
      <View className={inline ? 'shrink grow' : 'flex-1'}>{children}</View>
      {!minimal && (top || bottom) ? (
        <View testID={`${testID}-details`} className={inline ? `ml-1 flex-row items-center ${tight ? 'gap-1' : 'gap-1.5'}` : 'items-end'}>
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
        {tightUnit(template, 12)}
      </Text>
    </View>
  );
}

/** The longest distance the CTR row shows, short of the other side of the world. */
const DISTANCE_TEMPLATE = '0000 km';
const BEARING_TEMPLATE: Record<AngleUnit, string> = { deg: '000°', mil: '0000 mils' };
/** The longest altitude and accuracy (to 9,999 m / 99,999 ft). */
const ALTITUDE_TEMPLATE: Record<AltitudeUnit, string> = { m: 'ALT 0000 m', ft: 'ALT 00000 ft' };
const ACCURACY_TEMPLATE: Record<AltitudeUnit, string> = { m: '±0000 m', ft: '±00000 ft' };
/** A held average (paused) adds HELD before the accuracy. */
const HELD_ACCURACY_TEMPLATE: Record<AltitudeUnit, string> = { m: 'HELD ±0000 m', ft: 'HELD ±00000 ft' };

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
          <OutlinedText testID="op-elevation" accessibilityLabel={`Altitude ${formatLength(elevationM, unit)}`} color={colors['value-altitude']} style={glassHalo(colors)} className="font-mono text-xs">
            {tightUnit(`ALT ${formatLength(elevationM, unit)}`, 12)}
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
  const phase = useGpsAverage((s) => s.phase);
  const shown = me.kind === 'fix' ? me.fix : null;
  const setting = me.kind === 'set';
  // An averaged position leads with an orange AVG (like OP mode recolors its lead); held while paused, it shows a pause
  // icon and HELD before the accuracy. The grid stays friendly blue: it is still your position.
  const averaged = shown?.averaged === true;
  const held = averaged && phase !== 'averaging';
  const lead = averaged ? colors.averaged : colors.friendly;
  const leadIcon = held ? 'pause-circle-outline' : averaged ? 'crosshairs-gps' : 'navigation';
  // Without a fix, invisible stand-ins hold the space the grid and its details will take, so the card does not grow when GPS arrives.
  const detailPlaceholder = (template: string) => (
    <Placeholder>
      <OutlinedText color={colors.friendly} style={halo} className="font-mono text-xs" numberOfLines={1}>
        {tightUnit(template, 12)}
      </OutlinedText>
    </Placeholder>
  );
  const hint = (
    <OutlinedText testID="set-location-hint" color={colors.friendly} style={halo} className="text-xs">
      Tap to set your location
    </OutlinedText>
  );
  // Stacked, the hint would sit on the lower of the two detail lines, below the centered message (by more on Android,
  // whose lines are taller). It goes beside the two lines instead, in a column of no width, and centers on the row.
  const stackedHint = (
    <View testID="set-location-hint-frame" className="flex-row items-center">
      <View style={{ width: 0, overflow: 'hidden' }}>
        {detailPlaceholder(ALTITUDE_TEMPLATE[unit])}
        {detailPlaceholder(ACCURACY_TEMPLATE[unit])}
      </View>
      {hint}
    </View>
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
        tight
        lead={<CardLead icon={<Icon testID="me-icon" name={leadIcon} size={inline ? 12 : 14} color={lead} outline />} tag={averaged ? 'AVG' : 'ME'} tagColor={lead} tagStyle={halo} outline />}
        top={
          shown && !shown.manual ? (
            <Reserve inline={inline} template={ALTITUDE_TEMPLATE[unit]}>
              <OutlinedText testID="gps-altitude" accessibilityLabel={`Altitude ${formatLength(shown.altitudeM, unit)}`} color={colors['value-altitude']} style={halo} className="font-mono text-xs">
                {tightUnit(`ALT ${formatLength(shown.altitudeM, unit)}`, 12)}
              </OutlinedText>
            </Reserve>
          ) : shown || (setting && !inline) ? null : (
            detailPlaceholder(ALTITUDE_TEMPLATE[unit])
          )
        }
        bottom={
          shown?.manual ? (
            <OutlinedText testID="gps-manual" color={colors.friendly} style={halo} className="font-mono text-xs">
              MANUAL
            </OutlinedText>
          ) : setting ? (
            inline ? hint : stackedHint
          ) : shown ? (
            <Reserve inline={inline} template={(held ? HELD_ACCURACY_TEMPLATE : ACCURACY_TEMPLATE)[unit]}>
              <View
                accessible={averaged}
                accessibilityLabel={averaged ? `${held ? 'Held average' : 'Averaged'}, accuracy ±${formatLength(shown.accuracyM, unit)}` : undefined}
                className="flex-row items-center gap-1">
                {held ? (
                  <OutlinedText testID="gps-held" color={colors.averaged} style={halo} className="font-mono-bold text-xs">
                    HELD
                  </OutlinedText>
                ) : null}
                <OutlinedText testID="gps-accuracy" accessibilityLabel={averaged ? undefined : `Accuracy ±${formatLength(shown.accuracyM, unit)}`} color={colors['value-accuracy']} style={halo} className="font-mono text-xs">
                  {tightUnit(`±${formatLength(shown.accuracyM, unit)}`, 12)}
                </OutlinedText>
              </View>
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
            <OutlinedText testID="readout-range" accessibilityLabel={`Distance from ${who} ${r.distance}`} color={colors['value-distance']} style={halo} className="font-mono text-xs">
              {tightUnit(r.distance, 12)}
            </OutlinedText>
          </Reserve>
        </>
      }
      bottom={
        <Reserve inline={inline} template={BEARING_TEMPLATE[angleUnit]}>
          <OutlinedText testID="readout-bearing" accessibilityLabel={`Bearing from ${who} ${r.bearing} ${r.ref}`} color={colors['value-bearing']} style={halo} className="font-mono text-xs">
            {tightUnit(r.bearing, 12)}
          </OutlinedText>
        </Reserve>
      }>
      <Grid testID="readout-coordinate" outline small={inline}>
        {r.coordinate}
      </Grid>
    </Row>
  );
}
