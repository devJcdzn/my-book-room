import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, typography } from '@/src/theme';
import { getLibraryPalette } from '@/src/library-palette';

export default function BooksLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const paletteId = useLibraryStore((state) => state.libraryBackgroundId);
  const libraryPalette = getLibraryPalette(paletteId)[isNight ? 'dark' : 'light'];

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: isNight ? darkTheme.bg : colors.cream,
        },
        headerTintColor: isNight ? darkTheme.accent : colors.terracotta,
        headerTitleStyle: {
          color: isNight ? darkTheme.text : colors.ink,
          fontFamily: typography.editorial,
        },
        contentStyle: {
          backgroundColor: isNight ? darkTheme.bg : colors.cream,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Biblioteca',
          headerLargeTitle: false,
          headerTitleStyle: {
            color: isNight ? darkTheme.text : colors.ink,
            fontFamily: typography.editorial,
            fontSize: 21,
          },
          headerLeft: process.env.EXPO_OS !== 'ios' ? () => (
            <Pressable
              accessibilityHint="Abre o catálogo completo de livros"
              accessibilityLabel="Abrir catálogo"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.navigate('/books/catalog');
              }}
              style={({ pressed }) => [styles.headerAddBtn, isNight && styles.darkHeaderAddBtn, pressed && styles.btnPressed]}
            >
              <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="library-outline" size={21} />
            </Pressable>
          ) : undefined,
          headerRight: process.env.EXPO_OS !== 'ios' ? () => (
            <Pressable
              accessibilityHint="Abre as opções de aparência da biblioteca"
              accessibilityLabel="Personalizar aparência da biblioteca"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.navigate('/books/appearance');
              }}
              style={({ pressed }) => [
                styles.headerAddBtn,
                isNight && styles.darkHeaderAddBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="color-palette-outline" size={21} />
            </Pressable>
          ) : undefined,
        }}
      />
      <Stack.Screen
        name="catalog"
        options={{
          title: 'Catálogo',
          headerBackButtonDisplayMode: 'minimal',
          headerTitleStyle: {
            color: isNight ? darkTheme.text : colors.ink,
            fontFamily: typography.editorial,
            fontSize: 21,
          },
        }}
      />
      <Stack.Screen
        name="appearance"
        options={{
          title: 'Aparência',
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: isNight ? darkTheme.accent : colors.terracotta,
          headerStyle: { backgroundColor: libraryPalette.background },
          contentStyle: { backgroundColor: libraryPalette.background },
          headerTitleStyle: { color: isNight ? darkTheme.text : colors.ink, fontFamily: typography.editorial, fontSize: 21 },
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerAddBtn: { ...controls.iconButton, backgroundColor: 'rgba(185, 95, 59, 0.08)', marginRight: 4 },
  darkHeaderAddBtn: {
    backgroundColor: 'rgba(182, 90, 61, 0.15)',
  },
  btnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
});
