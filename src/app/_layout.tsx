import '../global.css';

import { Stack } from 'expo-router';

import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return (
    <ThemeProvider theme="dark">
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
