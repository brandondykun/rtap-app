import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuTextField } from '@/components/menu/MenuTextField';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { gridMagneticAngle } from '@/lib/geo/north/convert';
import { declination } from '@/lib/geo/north/magnetic';
import type { AngleUnit, NorthRef } from '@/lib/geo/types';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';
import { useSettings, type CoordinateFormat } from '@/stores/settings';

import { defineMenu, type MenuComponentProps } from '../define-menu';
import { formatEastWest, formatEastWestBoth } from './settings-format';

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
  // The number a user sets on a compass against the map grid, so it gets its own highlighted card.
  return (
    <View accessible accessibilityLabel={`G-M angle here, grid to magnetic: ${value}`} className="rounded-xl border border-accent bg-accent-subtle px-3 py-2">
      <Text className="text-xs font-semibold uppercase tracking-widest text-accent">G-M angle here · grid → magnetic</Text>
      <Text testID="gm-angle" className="font-mono-bold text-2xl text-text">
        {value}
      </Text>
    </View>
  );
}

function ModelDeclinationHint() {
  const center = useInteraction((s) => s.cameraCenter);
  const model = center ? declination(center, new Date()) : null;
  return model !== null ? <Text className="text-sm text-text-muted">{`Declination here (true → magnetic, WMM2025): ${formatEastWestBoth(model)}`}</Text> : null;
}

export function SettingsMenu(_props: MenuComponentProps<'settings'>) {
  const close = useMenu((s) => s.closeMenu);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const override = useSettings((s) => s.declinationOverrideDeg);
  const setCoordinateFormat = useSettings((s) => s.setCoordinateFormat);
  const setAngleUnit = useSettings((s) => s.setAngleUnit);
  const setNorthRef = useSettings((s) => s.setNorthRef);
  const setDeclinationOverride = useSettings((s) => s.setDeclinationOverride);
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
            <MenuTextField
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
    </View>
  );
}

export const settingsMenu = defineMenu({
  id: 'settings',
  family: 'app',
  title: 'Settings',
  detents: ['half', 'full'],
  component: SettingsMenu,
});
