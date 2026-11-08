import '../global.css';

import { JetBrainsMono_500Medium, JetBrainsMono_700Bold, useFonts } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { isLandscape } from '@/features/map/layout';
import { getAppCommandContext } from '@/lib/db/app-command-context';
import { CommandContextProvider } from '@/lib/db/command-context-provider';
import { initMonitoring, wrapRoot } from '@/lib/monitoring/sentry';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

initMonitoring();
void SplashScreen.preventAutoHideAsync();

// Android draws no grabber (MissionNameForm adds one) and defaults to square corners: 28 is Material 3's sheet radius.
// The content background is square there too, so it takes the same radius or it hides the rounded sheet.
const SHEET_RADIUS = 28;
const ANDROID_SHEET = Platform.OS === 'android';

function ThemedStack() {
  const { colors } = useTheme();
  const missionSheet = {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    ...(ANDROID_SHEET
      ? {
          sheetCornerRadius: SHEET_RADIUS,
          contentStyle: { backgroundColor: colors.surface, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS },
        }
      : null),
  } as const;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      {/* First launch: it fades in and out, with nothing to swipe back to. */}
      <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="missions/new" options={missionSheet} />
      <Stack.Screen name="missions/rename/[missionId]" options={missionSheet} />
      {/* Room to explain: a full sheet, the same in portrait and landscape. */}
      <Stack.Screen name="callsign" options={{ presentation: 'modal' }} />
      {/* Edge swipes belong to the map, never to navigation. */}
      <Stack.Screen name="missions/[missionId]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

export default wrapRoot(RootLayout);

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ JetBrainsMono_500Medium, JetBrainsMono_700Bold });
  // A font failure falls back to the system font rather than blocking the app.
  const ready = fontsLoaded || fontError !== null;
  const { width, height } = useWindowDimensions();
  // iOS hides the status bar in landscape itself; Android keeps it unless asked, taking room from the map.
  const hideStatusBar = Platform.OS === 'android' && isLandscape(width, height);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Reports the keyboard as it starts to open on Android too (the menu panel follows it). The app is edge to edge:
          without the translucent flags Android would move it out from under the status and navigation bars. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <CommandContextProvider value={getAppCommandContext()}>
          <ThemeProvider theme="dark">
            <StatusBar style="light" hidden={hideStatusBar} />
            <ThemedStack />
          </ThemeProvider>
        </CommandContextProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
