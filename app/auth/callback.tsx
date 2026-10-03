import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/providers/auth-provider';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { completeOAuth } = useAuth();
  useEffect(() => {
    let active = true;
    const returnToOnboarding = useLibraryStore.getState().onboardingStatus === 'in_progress';
    const finish = typeof code === 'string' ? completeOAuth(code) : Promise.resolve();
    void finish.catch(() => undefined).finally(() => {
      if (!active) return;
      if (returnToOnboarding) router.dismissTo('/onboarding');
      else router.replace('/(tabs)/profile');
    });
    return () => { active = false; };
  }, [code, completeOAuth]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}><ActivityIndicator color={colors.terracotta} /></View>;
}
