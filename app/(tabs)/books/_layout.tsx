import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

export default function BooksLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: isNight ? '#131520' : colors.cream,
        },
        headerTintColor: isNight ? '#FFAE70' : colors.terracotta,
        headerTitleStyle: {
          color: isNight ? '#FAF4EB' : colors.ink,
          fontFamily: 'Georgia',
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: isNight ? '#131520' : colors.cream,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Minha Biblioteca',
          headerLargeTitle: false,
          headerTitleStyle: {
            color: isNight ? '#FAF4EB' : colors.ink,
            fontFamily: 'Georgia',
            fontWeight: '700',
            fontSize: 18,
          },
          headerRight: process.env.EXPO_OS !== 'ios' ? () => (
            <Pressable
              accessibilityHint="Abre a tela para adicionar novo livro à biblioteca"
              accessibilityLabel="Adicionar livro"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.navigate('/add-book');
              }}
              style={({ pressed }) => [
                styles.headerAddBtn,
                isNight && styles.darkHeaderAddBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="add" size={24} />
            </Pressable>
          ) : undefined,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(185, 95, 59, 0.08)',
    marginRight: 4,
  },
  darkHeaderAddBtn: {
    backgroundColor: 'rgba(255, 174, 112, 0.15)',
  },
  btnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
});
