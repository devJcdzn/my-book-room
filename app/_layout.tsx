import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { colors } from '@/src/theme';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.terracotta, background: colors.cream, card: colors.paper, text: colors.ink, border: colors.line } };

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.cream }, headerShadowVisible: false, headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, headerTitleStyle: { fontWeight: '700' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-book" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true, title: 'Adicionar livro' }} />
        <Stack.Screen name="book-progress" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.65, 0.95], sheetGrabberVisible: true, headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
