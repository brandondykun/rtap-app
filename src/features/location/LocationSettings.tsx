import { Linking, Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuGroup } from '@/components/menu/MenuGroup';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { useManualEntry } from '@/stores/manual-entry';
import { useMenu } from '@/stores/menu';
import { useMyLocation, type PositionSource } from '@/stores/my-location';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

const useLocationOff = () => usePresence((s) => s.locationStatus === 'denied' || s.locationStatus === 'unavailable');

/** Top of Settings while location is denied or unavailable: says so and links to the phone's settings for RTAP. */
export function LocationOffNotice() {
  const off = useLocationOff();
  const { colors } = useTheme();
  if (!off) return null;
  return (
    <View testID="location-off-notice" className="mx-4 mb-4 flex-row items-center gap-3 rounded-xl border border-danger px-3 py-3">
      <Icon name="map-marker-off-outline" size={18} color={colors.danger} />
      <Text className="flex-1 text-sm text-text">Location is off. Your GPS position is hidden until you turn it on.</Text>
      <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} hitSlop={8} className="active:opacity-60">
        <Text className="font-semibold text-accent">Open Settings</Text>
      </Pressable>
    </View>
  );
}

/**
 * Where "me" comes from: GPS (greyed out while location is off) or a position set by hand. Switching to GPS clears the
 * manual position. Set / Change close Settings and open the Set manually box on the map.
 */
export function LocationSettingsGroup() {
  const off = useLocationOff();
  const source = useMyLocation((s) => s.source);
  const manual = useMyLocation((s) => s.manual);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);

  const change = (next: PositionSource) => {
    if (next === source) return;
    if (next === 'gps') useMyLocation.getState().switchToGps();
    else useMyLocation.getState().switchToManual();
  };
  const edit = () => {
    useMenu.getState().closeMenu();
    useManualEntry.getState().open('settings', manual);
  };

  return (
    <MenuGroup title="Location" icon="crosshairs-gps">
      <MenuSection label="Use my position from">
        <MenuSegmented<PositionSource>
          options={[
            { value: 'gps', label: 'GPS', disabled: off },
            { value: 'manual', label: 'Manual' },
          ]}
          value={source}
          onChange={change}
        />
      </MenuSection>
      {source === 'manual' ? (
        <MenuSection label="Manual position">
          <View className="flex-row items-center gap-3">
            <Text className={`flex-1 ${manual ? 'font-mono-bold text-base text-text' : 'text-base text-text-muted'}`}>
              {manual ? formatCoordinate(manual, coordinateFormat) : 'Not set'}
            </Text>
            <MenuButton compact label={manual ? 'Change' : 'Set'} icon={manual ? 'pencil-outline' : 'crosshairs-gps'} onPress={edit} />
          </View>
        </MenuSection>
      ) : null}
    </MenuGroup>
  );
}
