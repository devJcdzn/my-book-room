import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

function HeaderAddButton() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  return (
    <Pressable
      accessibilityHint="Abre a tela para adicionar novo livro à biblioteca"
      accessibilityLabel="Adicionar livro"
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/add-book');
      }}
      style={({ pressed }) => [styles.nativeHeaderBtn, isNight && styles.darkHeaderBtn, pressed && styles.nativeHeaderBtnPressed]}
    >
      <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="add" size={28} />
    </Pressable>
  );
}

export default function TabLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: isNight ? '#161824' : colors.paper },
        headerTintColor: isNight ? '#F5E8D3' : colors.ink,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        sceneStyle: { backgroundColor: isNight ? '#131520' : colors.cream },
        tabBarActiveTintColor: isNight ? '#FFAE70' : colors.terracotta,
        tabBarInactiveTintColor: isNight ? '#7C839C' : colors.muted,
        tabBarStyle: {
          backgroundColor: isNight ? '#161824' : colors.paper,
          borderTopColor: isNight ? 'rgba(255, 255, 255, 0.08)' : colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ambiente',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="home-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'Minha Biblioteca',
          tabBarLabel: 'Biblioteca',
          headerTitle: 'Minha Biblioteca',
          headerRight: () => <HeaderAddButton />,
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="library-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="person-outline" size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  nativeHeaderBtn: {
    marginRight: 12,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeHeaderBtnPressed: {
    opacity: 0.5,
  },
  darkHeaderBtn: {
    opacity: 0.95,
  },
});
