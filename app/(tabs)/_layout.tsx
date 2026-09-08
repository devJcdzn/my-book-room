import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

export default function TabLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  if (process.env.EXPO_OS === 'ios') {
    return (
      <NativeTabs
        backgroundColor={isNight ? '#181A26' : '#FAF5EF'}
        blurEffect={isNight ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
        tintColor={isNight ? '#FFAE70' : colors.terracotta}
      >
        <NativeTabs.Trigger disableAutomaticContentInsets name="index">
          <NativeTabs.Trigger.Icon md="home" sf="house.fill" />
          <NativeTabs.Trigger.Label>Ambiente</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="books">
          <NativeTabs.Trigger.Icon md="auto_stories" sf="books.vertical.fill" />
          <NativeTabs.Trigger.Label>Biblioteca</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon md="person" sf="person.crop.circle.fill" />
          <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isNight ? '#181A26' : '#FAF5EF',
          borderTopColor: isNight ? '#2C3044' : '#E8DFD1',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: isNight ? '#FFAE70' : colors.terracotta,
        tabBarInactiveTintColor: isNight ? '#9EA3B0' : colors.muted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ambiente',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'Biblioteca',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'book' : 'book-outline'} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons color={color} name={focused ? 'person' : 'person-outline'} size={22} />
          ),
        }}
      />
    </Tabs>
  );
}
