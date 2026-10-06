import AsyncStorage from '@react-native-async-storage/async-storage';
import { HimetricaProvider, useHimetrica } from '@himetrica/tracker-react-native/react';
import Constants from 'expo-constants';
import { useSegments } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from './auth-provider';
import { connectAnalytics, initializeAnalytics, identifyAnalytics, retryAnalyticsIdentity, trackAnalyticsScreen } from '../services/analytics';
import { useLibraryStore } from '../store/library-store';

const apiKey = process.env.EXPO_PUBLIC_HIMETRICA_API_KEY;
const enabled = !__DEV__ && process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true' && Boolean(apiKey);
const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown';
const accountKey = 'nookly_analytics_account';

function AnalyticsBridge() {
  const client = useHimetrica();
  const { user, provider, isLoading, isAuthenticating } = useAuth();
  const name = useLibraryStore((state) => state.profile.name);
  const segments = useSegments();
  const route = JSON.stringify(segments);

  useEffect(() => {
    const disconnect = connectAnalytics(client, { platform: Platform.OS, app_version: appVersion },
      initializeAnalytics(client).then(() => AsyncStorage.getItem(accountKey)),
      (id) => id ? AsyncStorage.setItem(accountKey, id) : AsyncStorage.removeItem(accountKey));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void retryAnalyticsIdentity();
    });
    return () => { subscription.remove(); disconnect(); };
  }, [client]);

  useEffect(() => {
    if (isLoading || isAuthenticating) return;
    void identifyAnalytics(user ? {
      userId: user.id,
      ...(name ? { name } : {}),
      ...(user.email ? { email: user.email } : {}),
      metadata: { ...(provider ? { provider } : {}), ...(user.created_at ? { created_at: user.created_at } : {}) },
    } : null);
  }, [isLoading, isAuthenticating, name, provider, user]);

  useEffect(() => {
    if (!isLoading) trackAnalyticsScreen(JSON.parse(route) as string[]);
  }, [isLoading, route]);
  return null;
}

export function AnalyticsProvider({ children }: PropsWithChildren) {
  if (!enabled) return children;
  return <HimetricaProvider apiKey={apiKey!} appVersion={appVersion} autoTrackScreens={false} enableLogging={false}>
    <AnalyticsBridge />
    {children}
  </HimetricaProvider>;
}
