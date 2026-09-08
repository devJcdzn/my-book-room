import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import 'react-native-reanimated';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  const theme = useMemo(() => {
    if (isNight) {
      return {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: '#FFAE70',
          background: '#131520',
          card: '#181A26',
          text: '#FAF4EB',
          border: '#2C3044',
        },
      };
    }
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.terracotta,
        background: colors.cream,
        card: colors.paper,
        text: colors.ink,
        border: colors.line,
      },
    };
  }, [isNight]);

  return (
    <ThemeProvider value={theme}>
      <StatusBar animated style={isNight ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: isNight ? '#131520' : colors.cream },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: isNight ? '#181A26' : colors.paper },
          headerTintColor: isNight ? '#FAF4EB' : colors.ink,
          headerTitleStyle: { fontWeight: '700', color: isNight ? '#FAF4EB' : colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-book"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { flex: 1, backgroundColor: isNight ? '#131520' : colors.cream },
          }}
        />
        <Stack.Screen
          name="book-progress"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.65, 0.95],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { flex: 1, backgroundColor: isNight ? '#131520' : colors.paper },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
