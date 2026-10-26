import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { MenuGroup } from '@/components/menu/MenuGroup';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { TextField } from '@/components/ui/TextField';
import { CallsignSetting } from '@/features/profile/CallsignSetting';
import { gmConversion, gridMagneticAngle } from '@/lib/geo/north/convert';
import { declination } from '@/lib/geo/north/magnetic';
import type { AngleUnit, NorthRef } from '@/lib/geo/types';
import { gridShadeColors, type GridShade } from '@/theme/tokens';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';
import { useSettings, type AltitudeUnit, type Basemap, type CoordinateFormat, type LabelSize, type PanelBackground } from '@/stores/settings';

import { defineMenu, type MenuComponentProps } from '../define-menu';
import { formatAngleSize, formatEastWest, formatEastWestBoth, roundsToZero } from './settings-format';

const BASEMAP_OPTIONS: { value: Basemap; label: string }[] = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'topo', label: 'Topo' },
  { value: 'dark', label: 'Dark' },
];

const GRID_COLOR_LABELS: Record<GridShade, string> = { white: 'White', 'light-gray': 'Light gray', gray: 'Gray', 'dark-gray': 'Dark gray', black: 'Black' };

/** Each grid shade as a swatch of its color (the label is its accessible name). */
const GRID_COLOR_OPTIONS = (Object.keys(GRID_COLOR_LABELS) as GridShade[]).map((value) => ({
  value,
  label: GRID_COLOR_LABELS[value],
  icon: <View testID={`grid-swatch-${value}`} className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: gridShadeColors(value).line }} />,
}));

const PANEL_BACKGROUND_OPTIONS: { value: PanelBackground; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'solid', label: 'Solid' },
];

/** The store takes any height from 1 to 3; these are the steps offered. */
const TERRAIN_HEIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
  { value: '3', label: '3×' },
];

const DECLINATION_ERROR = 'Enter a number from −180 to 180 (east positive)';

/** Parsed declination text, or null when it is not a number yet ('', '-', '1e'). */
function parseDeclination(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

// Leaves subscribe to the camera themselves so a camera frame re-renders only these lines.
function GridMagneticLine() {
  const center = useInteraction((s) => s.cameraCenter);
  const angleUnit = useSettings((s) => s.angleUnit);
  const override = useSettings((s) => s.declinationOverrideDeg);
  const gm = center ? gridMagneticAngle(center, { date: new Date(), declinationOverrideDeg: override }) : null;
  const value = formatEastWest(gm, angleUnit);
  // The other unit too, so degrees and mils are both at hand whichever is chosen.
  const other = formatEastWest(gm, angleUnit === 'mil' ? 'deg' : 'mil');
  // The number a user sets on a compass against the map grid, so it stands out by size alone: no
  // border or fill, which would make it look like the selectable options above it.
  return (
    <View accessible accessibilityLabel={`G-M angle here, grid to magnetic: ${value}, ${other}`} className="pb-2 pt-4">
      <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">G-M angle here · grid → magnetic</Text>
      <Text testID="gm-angle" className="font-mono-bold text-2xl text-text">
        {value}
      </Text>
      <Text testID="gm-angle-other" className="font-mono text-base text-text-muted">
        {other}
      </Text>
      {gm !== null ? <GmConversionNote gm={gm} unit={angleUnit} /> : null}
    </View>
  );
}

/** The map sheet's declination note: whether to add or subtract the G-M angle, which flips with where you are. */
function GmConversionNote({ gm, unit }: { gm: number; unit: AngleUnit }) {
  const rule = roundsToZero(gm, unit) ? null : gmConversion(gm);
  if (rule === null) return <Text className="pt-2 text-sm text-text-muted">Grid and magnetic north agree here: nothing to add or subtract.</Text>;
  const size = formatAngleSize(gm, unit);
  return (
    <View className="gap-0.5 pt-2">
      <Text testID="gm-grid-to-magnetic" className="text-sm text-text-muted">
        Grid → magnetic: <Text className="font-semibold text-text">{`${rule.gridToMagnetic} ${size}`}</Text>
      </Text>
      <Text testID="gm-magnetic-to-grid" className="text-sm text-text-muted">
        Magnetic → grid: <Text className="font-semibold text-text">{`${rule.magneticToGrid} ${size}`}</Text>
      </Text>
    </View>
  );
}

function ModelDeclinationHint() {
  const center = useInteraction((s) => s.cameraCenter);
  const model = center ? declination(center, new Date()) : null;
  return model !== null ? <Text className="text-sm text-text-muted">{`Declination here (true → magnetic, WMM2025):\n${formatEastWestBoth(model)}`}</Text> : null;
}

export function SettingsMenu(_props: MenuComponentProps<'settings'>) {
  const close = useMenu((s) => s.closeMenu);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const override = useSettings((s) => s.declinationOverrideDeg);
  const setCoordinateFormat = useSettings((s) => s.setCoordinateFormat);
  const setAngleUnit = useSettings((s) => s.setAngleUnit);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const setAltitudeUnit = useSettings((s) => s.setAltitudeUnit);
  const setNorthRef = useSettings((s) => s.setNorthRef);
  const setDeclinationOverride = useSettings((s) => s.setDeclinationOverride);
  const basemap = useSettings((s) => s.basemap);
  const setBasemap = useSettings((s) => s.setBasemap);
  const labelSize = useSettings((s) => s.labelSize);
  const setLabelSize = useSettings((s) => s.setLabelSize);
  const showZoomButtons = useSettings((s) => s.showZoomButtons);
  const setShowZoomButtons = useSettings((s) => s.setShowZoomButtons);
  const showCenterGrid = useSettings((s) => s.showCenterGrid);
  const setShowCenterGrid = useSettings((s) => s.setShowCenterGrid);
  const showToolbarText = useSettings((s) => s.showToolbarText);
  const setShowToolbarText = useSettings((s) => s.setShowToolbarText);
  const showMgrsGrid = useSettings((s) => s.showMgrsGrid);
  const setShowMgrsGrid = useSettings((s) => s.setShowMgrsGrid);
  const showGridLabels = useSettings((s) => s.showGridLabels);
  const setShowGridLabels = useSettings((s) => s.setShowGridLabels);
  const showGrid100m = useSettings((s) => s.showGrid100m);
  const setShowGrid100m = useSettings((s) => s.setShowGrid100m);
  const gridColor = useSettings((s) => s.gridColor);
  const setGridColor = useSettings((s) => s.setGridColor);
  const terrainHeight = useSettings((s) => s.terrainExaggeration);
  const setTerrainHeight = useSettings((s) => s.setTerrainExaggeration);
  const terrainIn2d = useSettings((s) => s.terrainIn2d);
  const setTerrainIn2d = useSettings((s) => s.setTerrainIn2d);
  const panelBackground = useSettings((s) => s.panelBackground);
  const setPanelBackground = useSettings((s) => s.setPanelBackground);
  const [text, setText] = useState(override === null ? '' : String(override));
  const [error, setError] = useState<string | null>(null);
  // Text typed since the last commit; closing the menu with the keyboard up still saves it.
  const pending = useRef<string | null>(null);

  useEffect(
    () => () => {
      const value = pending.current === null ? null : parseDeclination(pending.current);
      if (value !== null) useSettings.getState().setDeclinationOverride(value);
    },
    [],
  );

  const toggleManual = (on: boolean) => {
    setError(null);
    pending.current = null;
    if (!on) {
      setDeclinationOverride(null);
      setText('');
      return;
    }
    const center = useInteraction.getState().cameraCenter;
    const model = center ? declination(center, new Date()) : 0;
    const start = Math.round(model * 10) / 10;
    setDeclinationOverride(start);
    setText(String(start));
  };

  // Saved only when the edit finishes (or the menu closes), so typing 200 never stores 20 on the way.
  const change = (next: string) => {
    setText(next);
    pending.current = next;
  };

  const commit = () => {
    pending.current = null;
    const value = parseDeclination(text);
    if (value === null || !setDeclinationOverride(value)) setError(DECLINATION_ERROR);
    else setError(null);
  };

  return (
    <View>
      <MenuHeader title="Settings" leading={{ label: 'Close', onPress: close }} />
      <MenuGroup title="Profile" icon="account-outline">
        <MenuSection label="Callsign">
          <CallsignSetting />
        </MenuSection>
      </MenuGroup>
      <MenuGroup title="Map" icon="map-outline">
        <MenuSection label="Basemap">
          <MenuSegmented<Basemap> options={BASEMAP_OPTIONS} value={basemap} onChange={setBasemap} />
        </MenuSection>
        <MenuSection label="Label text size">
          <MenuSegmented<LabelSize>
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
            value={labelSize}
            onChange={setLabelSize}
          />
        </MenuSection>
        <MenuSection label="3D terrain height">
          <MenuSegmented<string> options={TERRAIN_HEIGHT_OPTIONS} value={String(terrainHeight)} onChange={(v) => setTerrainHeight(Number(v))} />
          <Text className="text-xs text-text-muted">How much hills are raised in 3D. 1× is true scale.</Text>
          <MenuToggle label="Terrain in 2D" value={terrainIn2d} onValueChange={setTerrainIn2d} />
          <Text className="text-xs text-text-muted">Off lays the map flat in 2D. 3D always uses the height above.</Text>
        </MenuSection>
      </MenuGroup>
      <MenuGroup title="MGRS grid" icon="grid">
        <MenuSection label="Grid lines">
          <MenuToggle label="Show MGRS grid" value={showMgrsGrid} onValueChange={setShowMgrsGrid} />
          <MenuToggle label="Show grid labels" value={showGridLabels} disabled={!showMgrsGrid} onValueChange={setShowGridLabels} />
          <MenuToggle label="Show 100 m grid lines" value={showGrid100m} disabled={!showMgrsGrid} onValueChange={setShowGrid100m} />
        </MenuSection>
        <MenuSection label="Grid color">
          <MenuSegmented<GridShade> options={GRID_COLOR_OPTIONS} value={gridColor} disabled={!showMgrsGrid} onChange={setGridColor} />
        </MenuSection>
      </MenuGroup>
      <MenuGroup title="Units" icon="ruler">
        <MenuSection label="Coordinates">
          <MenuSegmented<CoordinateFormat>
            options={[
              { value: 'mgrs', label: 'MGRS' },
              { value: 'latlon', label: 'Lat/Lon' },
            ]}
            value={coordinateFormat}
            onChange={setCoordinateFormat}
          />
        </MenuSection>
        <MenuSection label="Angles">
          <MenuSegmented<AngleUnit>
            options={[
              { value: 'deg', label: 'Degrees' },
              { value: 'mil', label: 'Mils' },
            ]}
            value={angleUnit}
            onChange={setAngleUnit}
          />
        </MenuSection>
        <MenuSection label="Altitude">
          <MenuSegmented<AltitudeUnit>
            options={[
              { value: 'm', label: 'Meters' },
              { value: 'ft', label: 'Feet' },
            ]}
            value={altitudeUnit}
            onChange={setAltitudeUnit}
          />
        </MenuSection>
      </MenuGroup>
      <MenuGroup title="North & declination" icon="compass-outline">
        <MenuSection label="North reference">
          <MenuSegmented<NorthRef>
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'magnetic', label: 'Magnetic' },
              { value: 'true', label: 'True' },
            ]}
            value={northRef}
            onChange={setNorthRef}
          />
          <GridMagneticLine />
        </MenuSection>
        <MenuSection label="Declination">
          <MenuToggle label="Manual declination" value={override !== null} onValueChange={toggleManual} />
          {override !== null ? (
            <>
              <TextField
                mono
                accessibilityLabel="Declination degrees"
                value={text}
                onChangeText={change}
                onEndEditing={commit}
                onSubmitEditing={commit}
                keyboardType="numbers-and-punctuation"
                invalid={error !== null}
                placeholder="e.g. -10.6"
              />
              {error ? (
                <Text className="text-sm text-danger">{error}</Text>
              ) : parseDeclination(text) !== null ? (
                <Text className="text-sm text-text-muted">{`Manual declination (true → magnetic): ${formatEastWestBoth(parseDeclination(text))}`}</Text>
              ) : null}
            </>
          ) : null}
          <ModelDeclinationHint />
        </MenuSection>
      </MenuGroup>
      <MenuGroup title="Display" icon="cellphone">
        <MenuSection label="On screen">
          <MenuToggle label="Show zoom buttons" value={showZoomButtons} onValueChange={setShowZoomButtons} />
          <MenuToggle label="Show center grid" value={showCenterGrid} onValueChange={setShowCenterGrid} />
          <MenuToggle label="Show toolbar text" value={showToolbarText} onValueChange={setShowToolbarText} />
        </MenuSection>
        <MenuSection label="Panel background">
          <MenuSegmented<PanelBackground> options={PANEL_BACKGROUND_OPTIONS} value={panelBackground} onChange={setPanelBackground} />
          <Text className="text-xs text-text-muted">How much the toolbar, readouts and map buttons hide the map. Heavier reads better over snow.</Text>
        </MenuSection>
      </MenuGroup>
    </View>
  );
}

export const settingsMenu = defineMenu({
  id: 'settings',
  family: 'app',
  title: 'Settings',
  icon: 'cog-outline',
  component: SettingsMenu,
});
