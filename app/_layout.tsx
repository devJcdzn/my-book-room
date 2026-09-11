import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

LogBox.ignoreLogs([
  'THREE.WARNING: Multiple instances of Three.js being imported.',
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
  'Clock: This module has been deprecated. Please use THREE.Timer instead.',
]);

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (
      first.includes('Multiple instances of Three.js being imported') ||
      first.includes('Clock: This module has been deprecated')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const hasHydrated = useLibraryStore((state) => state._hasHydrated);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  useEffect(() => {
    void useLibraryStore.persist.rehydrate();
  }, []);

  // Timer de segurança (3500ms) para garantir ocultação da splash screen mesmo em cenários extremos
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 3500);
    return () => clearTimeout(safetyTimer);
  }, []);

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

  if (!hasHydrated) return null;

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
            contentStyle: { height: '100%', width: '100%', flex: 1, backgroundColor: isNight ? '#131520' : colors.cream },
          }}
        />
        <Stack.Screen
          name="book-progress"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.65, 0.95],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { height: '100%', width: '100%', flex: 1, backgroundColor: isNight ? '#131520' : colors.paper },
          }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.65, 0.95],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { height: '100%', width: '100%', flex: 1, backgroundColor: isNight ? '#131520' : colors.paper },
          }}
        />
        <Stack.Screen
          name="customize-room"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.55, 0.85],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { height: '100%', width: '100%', flex: 1, backgroundColor: isNight ? '#131520' : colors.paper },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
