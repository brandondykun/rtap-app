import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuRow } from '@/components/menu/MenuRow';
import { MenuSection } from '@/components/menu/MenuSection';
import { captureBeforeLeave } from '@/features/map/canvas/mission-snapshot';
import { useMenu } from '@/stores/menu';

import { defineMenu, type MenuComponentProps } from '../define-menu';

export function AppRootMenu(_props: MenuComponentProps<'app.root'>) {
  const router = useRouter();
  const close = useMenu((s) => s.closeMenu);
  const switchMission = async () => {
    close();
    // The list shows where you left off: take the picture before the map goes away.
    await captureBeforeLeave();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View>
      <MenuHeader title="Menu" leading={{ label: 'Close', onPress: close }} />
      <MenuSection>
        <MenuRow icon="swap-horizontal" label="Switch mission" onPress={() => void switchMission()} />
        <MenuRow
          icon="information-outline"
          label="About"
          onPress={() => {
            close();
            router.push('/about');
          }}
        />
      </MenuSection>
    </View>
  );
}

export const appRootMenu = defineMenu({ id: 'app.root', family: 'app', title: 'Menu', detents: ['half', 'full'], component: AppRootMenu });
