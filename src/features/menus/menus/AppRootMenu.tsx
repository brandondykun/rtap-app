import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { Icon, type IconName } from '@/components/ui/Icon';
import { CurrentMissionCard } from '@/features/missions/list/CurrentMissionCard';
import { useMenu } from '@/stores/menu';
import { useTheme } from '@/theme/ThemeProvider';

import { defineMenu, type MenuComponentProps } from '../define-menu';

type Link = { icon: IconName; title: string; subtitle: string; onPress: () => void };

/** Rows in one bordered group, split by hairlines: an amber icon in a tile, a title over a muted line, a chevron. */
function LinkGroup({ links }: { links: readonly Link[] }) {
  const { colors } = useTheme();
  return (
    <View testID="menu-links" className="overflow-hidden rounded-2xl border border-border bg-surface-sunken">
      {links.map((link, i) => (
        <Fragment key={link.title}>
          {i > 0 ? <View className="h-px bg-border" /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={link.title} accessibilityHint={link.subtitle} onPress={link.onPress} className="flex-row items-center gap-4 p-4 active:opacity-60">
            <View className="h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-raised">
              <Icon name={link.icon} size={22} color={colors.accent} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-text">{link.title}</Text>
              <Text numberOfLines={1} className="text-sm text-text-muted">
                {link.subtitle}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors['text-muted']} />
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

export function AppRootMenu({ missionId }: MenuComponentProps<'app.root'>) {
  const router = useRouter();
  const close = useMenu((s) => s.closeMenu);
  const openMenu = useMenu((s) => s.openMenu);
  const switchMission = () => {
    // The mission screen pictures the map as it is removed (useMissionSnapshot's beforeRemove) and
    // closes the menu as it unmounts. Closing here would run first (the router acts after the next
    // render), sliding the map back to full width and dropping the panel the picture is cropped by.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const version = Constants.expoConfig?.version;
  return (
    // A little room between the pinned header and the first row.
    <View className="gap-4 px-4 pt-3">
      <MenuHeader title="Menu" leading={{ label: 'Close', icon: 'close', iconOnly: true, onPress: close }} badge="RTAP" />
      <CurrentMissionCard missionId={missionId} onSwitch={switchMission} />
      <LinkGroup
        links={[
          { icon: 'cog-outline', title: 'Settings', subtitle: 'Grid format, units, display', onPress: () => openMenu('settings', {}) },
          {
            icon: 'information-outline',
            title: 'About',
            subtitle: version ? `Toolbar guide · version ${version}` : 'Toolbar guide',
            onPress: () => {
              close();
              router.push('/about');
            },
          },
        ]}
      />
    </View>
  );
}

export const appRootMenu = defineMenu({ id: 'app.root', family: 'app', title: 'Menu', icon: 'menu', component: AppRootMenu });
