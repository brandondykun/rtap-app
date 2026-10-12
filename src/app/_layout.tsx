import '../global.css';

import { JetBrainsMono_500Medium, JetBrainsMono_700Bold, useFonts } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getAppCommandContext } from '@/lib/db/app-command-context';
import { CommandContextProvider } from '@/lib/db/command-context-provider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen
        name="missions/new"
        options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ JetBrainsMono_500Medium, JetBrainsMono_700Bold });
  // A font failure falls back to the system font rather than blocking the app.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CommandContextProvider value={getAppCommandContext()}>
        <ThemeProvider theme="dark">
          <StatusBar style="light" />
          <ThemedStack />
        </ThemeProvider>
      </CommandContextProvider>
    </GestureHandlerRootView>
  );
}
