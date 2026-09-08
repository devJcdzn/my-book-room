import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/src/theme';

function HeaderAddButton() {
  return (
    <Pressable
      accessibilityHint="Abre a tela para adicionar novo livro à biblioteca"
      accessibilityLabel="Adicionar livro"
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/add-book');
      }}
      style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
    >
      <Ionicons color={colors.terracotta} name="add" size={26} />
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        sceneStyle: { backgroundColor: colors.cream },
        tabBarActiveTintColor: colors.terracotta,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
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
          title: 'Livros',
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
  headerBtn: {
    marginRight: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(53, 42, 36, 0.12)',
  },
  headerBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
