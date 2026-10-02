import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { TabBarContext } from '@/src/context/tab-bar-context';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme } from '@/src/theme';

export default function TabLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const insets = useSafeAreaInsets();
  const activeColor = isNight ? darkTheme.accent : colors.terracotta;
  const inactiveColor = isNight ? darkTheme.textMuted : colors.inkSoft;
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);

  if (process.env.EXPO_OS === 'ios') {
    return (
      <TabBarContext.Provider value={{ setIsTabBarHidden }}>
        <NativeTabs
          backgroundColor={isNight ? darkTheme.surface : colors.paper}
          disableTransparentOnScrollEdge
          unstable_nativeProps={{ colorScheme: isNight ? 'dark' : 'light' }}
          iconColor={{ default: inactiveColor, selected: activeColor }}
          labelStyle={{
            default: { color: inactiveColor, fontSize: 12, fontWeight: '600' },
            selected: { color: activeColor, fontSize: 12, fontWeight: '600' },
          }}
          blurEffect={isNight ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          hidden={isTabBarHidden}
          tintColor={activeColor}
        >
          <NativeTabs.Trigger disableAutomaticContentInsets name="index">
            <NativeTabs.Trigger.Icon md="home" sf="house.fill" />
            <NativeTabs.Trigger.Label>Ambiente</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="books">
            <NativeTabs.Trigger.Icon md="auto_stories" sf="books.vertical.fill" />
            <NativeTabs.Trigger.Label>Biblioteca</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="diary">
            <NativeTabs.Trigger.Icon md="edit_note" sf="book.pages.fill" />
            <NativeTabs.Trigger.Label>Diário</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="profile">
            <NativeTabs.Trigger.Icon md="person" sf="person.crop.circle.fill" />
            <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </TabBarContext.Provider>
    );
  }

  return (
    <TabBarContext.Provider value={{ setIsTabBarHidden }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isNight ? darkTheme.surface : colors.paper,
            borderTopColor: isNight ? darkTheme.border : colors.line,
            borderTopWidth: StyleSheet.hairlineWidth,
            display: isTabBarHidden ? 'none' : 'flex',
            height: 62 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 6,
          },
          tabBarActiveTintColor: activeColor,
          tabBarInactiveTintColor: inactiveColor,
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
          name="diary"
          options={{
            title: 'Diário',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons color={color} name={focused ? 'journal' : 'journal-outline'} size={22} />
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
    </TabBarContext.Provider>
  );
}
