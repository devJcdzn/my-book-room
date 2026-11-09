import { Stack } from 'expo-router';

import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme } from '@/src/theme';
import { resolveAmbience } from '@/src/types/ambience';

export default function DiaryLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: isNight ? darkTheme.bg : colors.cream },
    }} />
  );
}
