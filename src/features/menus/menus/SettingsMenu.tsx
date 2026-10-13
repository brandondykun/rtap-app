import { useState } from 'react';
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
import { formatEastWest } from './settings-format';

const DECLINATION_ERROR = 'Enter a number from −180 to 180 (east positive)';

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
  const center = useInteraction((s) => s.cameraCenter);

  const date = new Date();
  const model = center ? declination(center, date) : null;
  const gm = center ? gridMagneticAngle(center, { date, declinationOverrideDeg: override }) : null;
  const [text, setText] = useState(override === null ? '' : String(override));
  const [error, setError] = useState<string | null>(null);

  const toggleManual = (on: boolean) => {
    setError(null);
    if (!on) {
      setDeclinationOverride(null);
      setText('');
      return;
    }
    const start = Math.round((model ?? 0) * 10) / 10;
    setDeclinationOverride(start);
    setText(String(start));
  };

  const commit = () => {
    const value = Number(text.replace(',', '.'));
    if (text.trim() === '' || !setDeclinationOverride(value)) setError(DECLINATION_ERROR);
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
        <Text className="text-sm text-text-muted">{`G-M angle here: ${formatEastWest(gm, angleUnit)}`}</Text>
      </MenuSection>
      <MenuSection label="Declination">
        <MenuToggle label="Manual declination" value={override !== null} onValueChange={toggleManual} />
        {override !== null ? (
          <>
            <MenuTextField
              mono
              accessibilityLabel="Declination degrees"
              value={text}
              onChangeText={setText}
              onEndEditing={commit}
              onSubmitEditing={commit}
              keyboardType="numbers-and-punctuation"
              invalid={error !== null}
              placeholder="e.g. -10.6"
            />
            {error ? <Text className="text-sm text-danger">{error}</Text> : null}
          </>
        ) : null}
        {model !== null ? <Text className="text-sm text-text-muted">{`Model (WMM2025) here: ${formatEastWest(model, 'deg')}`}</Text> : null}
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
