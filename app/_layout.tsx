import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { AuthProvider, useAuth } from '@/src/providers/auth-provider';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, typography } from '@/src/theme';

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

function OnboardingRedirect() {
  const { isLoading } = useAuth();
  const onboardingStatus = useLibraryStore((state) => state.onboardingStatus);
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || pathname === '/onboarding' || pathname === '/auth/callback'
      || (from === 'onboarding' && (pathname === '/add-book' || pathname === '/books/catalog' || pathname === '/book-progress'))) return;
    if (onboardingStatus === 'not_started' || onboardingStatus === 'in_progress') {
      router.replace('/onboarding' as Href);
    }
  }, [from, isLoading, onboardingStatus, pathname, router]);
  return null;
}

export default function RootLayout() {
  const hasHydrated = useLibraryStore((state) => state._hasHydrated);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const onboardingStatus = useLibraryStore((state) => state.onboardingStatus);
  const activeReadingTimer = useLibraryStore((state) => state.activeReadingTimer);
  const pathname = usePathname();
  const router = useRouter();
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const restoredReadingTimer = useRef(false);

  useEffect(() => {
    void useLibraryStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [hasHydrated]);

  useEffect(() => {
    const onboardingComplete = onboardingStatus === 'completed' || onboardingStatus === 'skipped';
    const isHomeRoute = pathname === '/' || pathname === '/index' || pathname.startsWith('/(tabs)');
    if (!hasHydrated || !onboardingComplete || !activeReadingTimer || restoredReadingTimer.current || !isHomeRoute) return;
    restoredReadingTimer.current = true;
    router.replace('/reading-timer' as Href);
  }, [activeReadingTimer, hasHydrated, onboardingStatus, pathname, router]);

  const theme = useMemo(() => {
    if (isNight) {
      return {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: darkTheme.accent,
          background: darkTheme.bg,
          card: darkTheme.surface,
          text: darkTheme.text,
          border: darkTheme.border,
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
    <AuthProvider>
      <OnboardingRedirect />
      <ThemeProvider value={theme}>
        <StatusBar animated style={isNight ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: isNight ? darkTheme.surface : colors.paper },
            headerTintColor: isNight ? darkTheme.text : colors.ink,
            headerTitleStyle: { fontWeight: '700', color: isNight ? darkTheme.text : colors.ink },
          }}
        >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{
            animation: 'fade',
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="account"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            title: 'Conta e sincronização',
            contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
          }}
        />
        <Stack.Screen
          name="add-book"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { height: '100%', width: '100%', flex: 1, backgroundColor: isNight ? darkTheme.bg : colors.cream },
          }}
        />
        <Stack.Screen
          name="book-progress"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
            gestureEnabled: true,
            headerShown: false,
            contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.terracotta },
          }}
        />
        <Stack.Screen name="reading-timer" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="reading-session" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen
          name="edit-profile"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
            gestureEnabled: true,
            title: 'Editar perfil',
            headerShown: true,
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
            headerTintColor: isNight ? darkTheme.text : colors.ink,
            headerTitleStyle: {
              color: isNight ? darkTheme.text : colors.ink,
              fontFamily: typography.editorial,
              fontSize: 21,
            },
            contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
          }}
        />
        <Stack.Screen
          name="customize-room"
          options={{
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.55, 0.85],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { height: '100%', width: '100%', flex: 1, backgroundColor: isNight ? darkTheme.bg : colors.paper },
          }}
        />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
