import { useReducedMotion } from 'react-native-reanimated';
import { SaveFeedback } from '@/src/components/save-feedback';
import { AppDialog } from '@/src/components/app-dialog';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ScreenBackButton } from '@/src/components/screen-header';
import { resolveAmbience } from '@/src/types/ambience';
import { CollectionPurchasesLifecycle } from '@/src/services/collection-purchases';
import { useCollectionPurchases } from '@/src/services/collection-access';
import { IAP_ENABLED } from '@/src/config/features';
import { AnalyticsProvider } from '@/src/providers/analytics-provider';
import { AuthProvider, useAuth } from '@/src/providers/auth-provider';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, typography } from '@/src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({
  duration: 260,
  fade: true,
});

export const unstable_settings = { anchor: '(tabs)' };

function StartupSplash() {
  const { isLoading } = useAuth();
  const purchasesChecked = useCollectionPurchases(state => state.checked);
  const onboardingStatus = useLibraryStore(state => state.onboardingStatus);
  const dismissed = useRef(false);
  const needsCollectionAccess = onboardingStatus === 'completed' || onboardingStatus === 'skipped';
  const ready = !isLoading && (!needsCollectionAccess || !IAP_ENABLED || purchasesChecked);
  useEffect(() => {
    if (dismissed.current) return;
    const dismiss = () => {
      dismissed.current = true;
      void SplashScreen.hideAsync().catch(() => undefined);
    };
    if (ready) { dismiss(); return; }
    // A stalled network must not trap the user behind a native splash.
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [ready]);
  return null;
}

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
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const hasHydrated = useLibraryStore((state) => state._hasHydrated);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const onboardingStatus = useLibraryStore((state) => state.onboardingStatus);
  const router = useRouter();
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const coverRewardBookId = useLibraryStore((state) => state.coverRewardBookId);

  useEffect(() => {
    if (completingBookId) useLibraryStore.getState().finalizeCompletion(completingBookId);
  }, [completingBookId]);

  useEffect(() => {
    if (!hasHydrated || !coverRewardBookId) return;
    useLibraryStore.getState().dismissCoverReward();
    if (onboardingStatus !== 'completed' && onboardingStatus !== 'skipped') return;
    router.push({ pathname: '/book-reward', params: { bookId: coverRewardBookId } } as Href);
  }, [coverRewardBookId, hasHydrated, onboardingStatus, router]);


  useEffect(() => {
    void useLibraryStore.persist.rehydrate();
  }, []);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      <CollectionPurchasesLifecycle />
      <StartupSplash />
      <AnalyticsProvider>
      <OnboardingRedirect />
      <ThemeProvider value={theme}>
        <StatusBar animated style={isNight ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            animation: reduceMotion ? 'none' : 'default',
            contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: isNight ? darkTheme.surface : colors.paper },
            headerBackVisible: false,
            headerLeft: ({ canGoBack }) => canGoBack ? <ScreenBackButton isNight={isNight} onPress={() => router.back()} /> : null,
            headerTintColor: isNight ? darkTheme.text : colors.ink,
            headerTitleStyle: { fontWeight: '700', color: isNight ? darkTheme.text : colors.ink },
          }}
        >
        <Stack.Screen name="book-reward" options={{ headerShown: false, presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{
            animation: reduceMotion ? 'none' : 'fade',
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
            headerShown: false,
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
            animation: reduceMotion ? 'none' : 'slide_from_right',
            gestureEnabled: true,
            headerShown: false,
            contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.terracotta },
          }}
        />
        <Stack.Screen name="reading-log" options={{ headerBackButtonDisplayMode: 'minimal', animation: reduceMotion ? 'none' : 'slide_from_right' }} />
        {/* The timer confirms exit before starting a pop. An interactive swipe would expose the previous screen first. */}
        <Stack.Screen name="reading-timer" options={{ headerShown: false, animation: reduceMotion ? 'none' : 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="reading-session" options={{ headerShown: false, animation: reduceMotion ? 'none' : 'slide_from_right' }} />
        <Stack.Screen
          name="edit-profile"
          options={{
            presentation: 'card',
            animation: reduceMotion ? 'none' : 'slide_from_right',
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
        <SaveFeedback />
        <AppDialog enabled={pathname !== '/account' && pathname !== '/book-reward' && pathname !== '/reading-session'} />
      </ThemeProvider>
      </AnalyticsProvider>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
