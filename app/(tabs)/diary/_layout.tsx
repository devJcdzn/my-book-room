import { Stack } from 'expo-router';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, typography } from '@/src/theme';

export default function DiaryLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
        headerTintColor: isNight ? darkTheme.accent : colors.terracotta,
        headerTitleStyle: {
          color: isNight ? darkTheme.text : colors.ink,
          fontFamily: typography.editorial,
          fontSize: 19,
        },
        contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Diário',
          headerLargeTitle: false,
          headerTitleStyle: {
            color: isNight ? darkTheme.text : colors.ink,
            fontFamily: typography.editorial,
            fontSize: 21,
          },
        }}
      />
      <Stack.Screen name="note" options={{ headerBackButtonDisplayMode: 'minimal' }} />
      <Stack.Screen name="session-edit" options={{ headerBackButtonDisplayMode: 'minimal' }} />
    </Stack>
  );
}
