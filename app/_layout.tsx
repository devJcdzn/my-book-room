import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.terracotta, background: colors.cream, card: colors.paper, text: colors.ink, border: colors.line } };

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

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
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            title: 'Adicionar livro',
            headerStyle: { backgroundColor: isNight ? '#181A26' : colors.paper },
            headerTintColor: isNight ? '#FAF4EB' : colors.ink,
            headerTitleStyle: { fontWeight: '700', color: isNight ? '#FAF4EB' : colors.ink },
            contentStyle: { backgroundColor: isNight ? '#131520' : colors.cream },
          }}
        />
        <Stack.Screen
          name="book-progress"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.65, 0.95],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { backgroundColor: isNight ? '#131520' : colors.cream },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
